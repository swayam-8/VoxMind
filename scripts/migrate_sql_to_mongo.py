#!/usr/bin/env python3
"""
VoxMind SQL to MongoDB Migration Utility
Migrates legacy SQLite/PostgreSQL data into MongoDB with verification.
"""

import os
import sys
import json
import sqlite3
from datetime import datetime
from pymongo import MongoClient

def parse_iso_or_none(val):
    if not val or val == 'None':
        return None
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return datetime.utcnow()

def run_migration(sqlite_path='backend-flask/instance/voxmind.db', mongo_uri=None):
    if not mongo_uri:
        mongo_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/voxmind')

    print(f"=== VoxMind SQL to MongoDB Migration ===")
    print(f"Source SQLite: {sqlite_path}")
    print(f"Target Mongo:  {mongo_uri}")

    if not os.path.exists(sqlite_path):
        print(f"Error: Source SQLite database not found at {sqlite_path}")
        return False

    sql_conn = sqlite3.connect(sqlite_path)
    sql_conn.row_factory = sqlite3.Row
    cursor = sql_conn.cursor()

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        # Verify connection
        client.admin.command('ping')
        db = client.get_database()
        print("Connected to MongoDB successfully.")
    except Exception as e:
        print(f"Warning: Could not connect to live MongoDB ({e}). Running in verification dry-run mode.")
        db = None

    stats = {}

    # 1. Users
    cursor.execute("SELECT * FROM users")
    sql_users = [dict(r) for r in cursor.fetchall()]
    stats['users'] = {'source': len(sql_users), 'migrated': 0}
    for u in sql_users:
        doc = {
            '_id': str(u['id']),
            'email': u['email'].lower().strip(),
            'passwordHash': u['password_hash'],
            'fullName': u.get('full_name') or '',
            'isActive': bool(u.get('is_active', 1)),
            'isSuperuser': bool(u.get('is_superuser', 0)),
            'createdAt': parse_iso_or_none(u.get('created_at')),
            'updatedAt': parse_iso_or_none(u.get('updated_at')),
        }
        if db is not None:
            db.users.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['users']['migrated'] += 1

    # 2. Workspaces
    cursor.execute("SELECT * FROM workspaces")
    sql_workspaces = [dict(r) for r in cursor.fetchall()]
    stats['workspaces'] = {'source': len(sql_workspaces), 'migrated': 0}
    for w in sql_workspaces:
        doc = {
            '_id': str(w['id']),
            'name': w['name'],
            'slug': w['slug'],
            'createdBy': str(w['created_by_user_id']),
            'isPersonal': False,
            'createdAt': parse_iso_or_none(w.get('created_at')),
            'updatedAt': parse_iso_or_none(w.get('updated_at')),
        }
        if db is not None:
            db.workspaces.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['workspaces']['migrated'] += 1

    # 3. Workspace Memberships
    cursor.execute("SELECT * FROM workspace_memberships")
    sql_memberships = [dict(r) for r in cursor.fetchall()]
    stats['workspace_memberships'] = {'source': len(sql_memberships), 'migrated': 0}
    for m in sql_memberships:
        doc = {
            '_id': str(m['id']),
            'workspaceId': str(m['workspace_id']),
            'userId': str(m['user_id']),
            'role': m['role'],
            'createdAt': parse_iso_or_none(m.get('created_at')),
            'updatedAt': parse_iso_or_none(m.get('updated_at')),
        }
        if db is not None:
            db.workspacememberships.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['workspace_memberships']['migrated'] += 1

    # 4. Collections
    cursor.execute("SELECT * FROM collections")
    sql_collections = [dict(r) for r in cursor.fetchall()]
    stats['collections'] = {'source': len(sql_collections), 'migrated': 0}
    for c in sql_collections:
        doc = {
            '_id': str(c['id']),
            'workspaceId': str(c['workspace_id']),
            'name': c['name'],
            'description': c.get('description') or '',
            'color': c.get('color') or '#6366f1',
            'createdById': str(sql_users[0]['id']) if sql_users else 'system',
            'createdAt': parse_iso_or_none(c.get('created_at')),
            'updatedAt': parse_iso_or_none(c.get('updated_at')),
        }
        if db is not None:
            db.collections.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['collections']['migrated'] += 1

    # 5. Recordings
    cursor.execute("SELECT * FROM recordings")
    sql_recordings = [dict(r) for r in cursor.fetchall()]
    stats['recordings'] = {'source': len(sql_recordings), 'migrated': 0}
    rec_ws_map = {}
    for r in sql_recordings:
        rec_id = str(r['id'])
        ws_id = str(r['workspace_id'])
        rec_ws_map[rec_id] = ws_id

        status = r.get('status', 'queued')
        if status == 'ready':
            status = 'completed'

        doc = {
            '_id': rec_id,
            'workspaceId': ws_id,
            'userId': str(r['user_id']),
            'collectionId': str(r['collection_id']) if r.get('collection_id') and str(r['collection_id']) != 'None' else None,
            'title': r['title'],
            'filename': r['filename'],
            'storagePath': r['storage_path'],
            'fileSizeBytes': int(r.get('file_size_bytes') or 0),
            'durationSeconds': float(r.get('duration_seconds') or 0.0),
            'mimeType': r.get('mime_type') or 'audio/wav',
            'status': status,
            'errorMessage': r.get('error_message') if r.get('error_message') != 'None' else None,
            'language': 'en',
            'indexStatus': r.get('index_status') or 'pending',
            'createdAt': parse_iso_or_none(r.get('created_at')),
            'updatedAt': parse_iso_or_none(r.get('updated_at')),
        }
        if db is not None:
            db.recordings.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['recordings']['migrated'] += 1

    # 6. Transcript Segments
    cursor.execute("SELECT * FROM transcript_segments")
    sql_segments = [dict(r) for r in cursor.fetchall()]
    stats['transcript_segments'] = {'source': len(sql_segments), 'migrated': 0}
    for s in sql_segments:
        doc = {
            '_id': str(s['id']),
            'recordingId': str(s['recording_id']),
            'segmentIndex': int(s['segment_index']),
            'startTime': float(s['start_time']),
            'endTime': float(s['end_time']),
            'speaker': s.get('speaker') or 'Speaker 1',
            'text': s['text'],
            'confidence': float(s.get('confidence') or 0.95),
            'createdAt': parse_iso_or_none(s.get('created_at')),
        }
        if db is not None:
            db.transcriptsegments.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['transcript_segments']['migrated'] += 1

    # 7. Summaries
    cursor.execute("SELECT * FROM summaries")
    sql_summaries = [dict(r) for r in cursor.fetchall()]
    stats['summaries'] = {'source': len(sql_summaries), 'migrated': 0}
    for s in sql_summaries:
        key_takeaways = []
        try:
            if s.get('key_takeaways'):
                key_takeaways = json.loads(s['key_takeaways'])
        except Exception:
            pass

        decisions = []
        try:
            if s.get('decisions'):
                raw_d = json.loads(s['decisions'])
                if isinstance(raw_d, list):
                    for item in raw_d:
                        if isinstance(item, dict) and 'decision' in item:
                            decisions.append(item['decision'])
                        else:
                            decisions.append(str(item))
        except Exception:
            pass

        topics = []
        try:
            if s.get('topics'):
                topics = json.loads(s['topics'])
        except Exception:
            pass

        doc = {
            '_id': str(s['id']),
            'recordingId': str(s['recording_id']),
            'modelName': s.get('model_name') or 'llama3.2',
            'summaryMarkdown': s.get('summary_markdown') or '',
            'keyTakeaways': key_takeaways,
            'decisions': decisions,
            'topics': topics,
            'actionItems': [],
            'promptTokens': 0,
            'completionTokens': 0,
            'createdAt': parse_iso_or_none(s.get('created_at')),
            'updatedAt': parse_iso_or_none(s.get('updated_at')),
        }
        if db is not None:
            db.summaries.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['summaries']['migrated'] += 1

    # 8. Action Items
    cursor.execute("SELECT * FROM action_items")
    sql_action_items = [dict(r) for r in cursor.fetchall()]
    stats['action_items'] = {'source': len(sql_action_items), 'migrated': 0}
    for a in sql_action_items:
        rec_id = str(a['recording_id'])
        doc = {
            '_id': str(a['id']),
            'recordingId': rec_id,
            'workspaceId': rec_ws_map.get(rec_id, str(sql_workspaces[0]['id']) if sql_workspaces else ''),
            'task': a['task'],
            'assignee': a.get('assignee') if a.get('assignee') != 'None' else None,
            'dueDate': a.get('due_date') if a.get('due_date') != 'None' else None,
            'status': 'completed' if int(a.get('completed', 0)) == 1 else 'pending',
            'priority': 'medium',
            'createdAt': parse_iso_or_none(a.get('created_at')),
            'updatedAt': parse_iso_or_none(a.get('updated_at')),
        }
        if db is not None:
            db.actionitems.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['action_items']['migrated'] += 1

    # 9. API Keys
    cursor.execute("SELECT * FROM api_keys")
    sql_api_keys = [dict(r) for r in cursor.fetchall()]
    stats['api_keys'] = {'source': len(sql_api_keys), 'migrated': 0}
    for k in sql_api_keys:
        doc = {
            '_id': str(k['id']),
            'workspaceId': str(k['workspace_id']),
            'userId': str(k['user_id']),
            'name': k['name'],
            'keyPrefix': k['key_prefix'],
            'keyHash': k['key_hash'],
            'isRevoked': bool(int(k.get('is_revoked', 0))),
            'lastUsedAt': parse_iso_or_none(k.get('last_used_at')),
            'expiresAt': parse_iso_or_none(k.get('expires_at')),
            'createdAt': parse_iso_or_none(k.get('created_at')),
            'updatedAt': parse_iso_or_none(k.get('updated_at')),
        }
        if db is not None:
            db.apikeys.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['api_keys']['migrated'] += 1

    # 10. API Usage Records
    cursor.execute("SELECT * FROM api_usage_records")
    sql_usage = [dict(r) for r in cursor.fetchall()]
    stats['api_usage_records'] = {'source': len(sql_usage), 'migrated': 0}
    for u in sql_usage:
        r_type = u.get('resource_type', 'qa')
        if r_type not in ['transcription', 'summary', 'embedding', 'qa']:
            r_type = 'qa'

        doc = {
            '_id': str(u['id']),
            'workspaceId': str(u['workspace_id']),
            'userId': None,
            'apiKeyId': str(u['api_key_id']) if u.get('api_key_id') and str(u['api_key_id']) != 'None' else None,
            'resourceType': r_type,
            'model': u.get('model_name') or 'llama3.2',
            'promptTokens': int(u.get('prompt_tokens') or 0),
            'completionTokens': int(u.get('completion_tokens') or 0),
            'totalTokens': int(u.get('total_tokens') or 0),
            'durationSeconds': float(u.get('duration_seconds') or 0.0),
            'statusCode': int(u.get('status_code') or 200),
            'createdAt': parse_iso_or_none(u.get('created_at')),
        }
        if db is not None:
            db.apiusagerecords.replace_one({'_id': doc['_id']}, doc, upsert=True)
            stats['api_usage_records']['migrated'] += 1

    print("\n--- Migration Summary Report ---")
    print(f"{'Collection / Table':<25} | {'Source Rows':<12} | {'Migrated Docs':<12}")
    print("-" * 55)
    for table, s in stats.items():
        print(f"{table:<25} | {s['source']:<12} | {s['migrated']:<12}")
    print("-" * 55)

    sql_conn.close()
    return True

if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'backend-flask/instance/voxmind.db'
    uri = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('MONGO_URI', 'mongodb://localhost:27017/voxmind')
    run_migration(src, uri)
