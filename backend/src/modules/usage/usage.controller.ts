import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiUsageRecord } from '../../database/models/ApiUsageRecord.js';

export class UsageController {
  static async getUsage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const days = Number(req.query.days) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const filter = {
        workspaceId,
        createdAt: { $gte: since },
      };

      const totals = await ApiUsageRecord.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalPromptTokens: { $sum: '$promptTokens' },
            totalCompletionTokens: { $sum: '$completionTokens' },
            totalTokens: { $sum: '$totalTokens' },
            totalDurationSeconds: { $sum: '$durationSeconds' },
            totalEvents: { $sum: 1 },
          },
        },
      ]);

      const breakdown = await ApiUsageRecord.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$resourceType',
            promptTokens: { $sum: '$promptTokens' },
            completionTokens: { $sum: '$completionTokens' },
            totalTokens: { $sum: '$totalTokens' },
            durationSeconds: { $sum: '$durationSeconds' },
            count: { $sum: 1 },
          },
        },
      ]);

      const recentEvents = await ApiUsageRecord.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const summary = totals[0] || {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalDurationSeconds: 0,
        totalEvents: 0,
      };

      const byResourceType: Record<string, { count: number; tokens: number; duration_seconds: number }> = {};
      for (const item of breakdown) {
        byResourceType[item._id] = {
          count: item.count,
          tokens: item.totalTokens,
          duration_seconds: Math.round(item.durationSeconds * 10) / 10,
        };
      }

      const byModel: Record<string, { count: number; tokens: number }> = {
        'faster-whisper-base': { count: 0, tokens: 0 },
        'llama3.2': { count: 0, tokens: summary.totalTokens },
      };

      const recentRecords = recentEvents.map((e) => ({
        id: e._id,
        endpoint: `/api/v1/${e.resourceType}`,
        method: 'POST',
        resource_type: e.resourceType,
        model_name: e.model || 'llama3.2',
        prompt_tokens: e.promptTokens,
        completion_tokens: e.completionTokens,
        total_tokens: e.totalTokens,
        duration_seconds: e.durationSeconds,
        response_time_ms: Math.round(e.durationSeconds * 1000),
        status_code: e.statusCode,
        created_at: e.createdAt.toISOString(),
      }));

      const payload = {
        total_requests: summary.totalEvents,
        total_processing_seconds: Math.round(summary.totalDurationSeconds * 10) / 10,
        total_processing_hours: Math.round((summary.totalDurationSeconds / 3600) * 100) / 100,
        prompt_tokens: summary.totalPromptTokens,
        completion_tokens: summary.totalCompletionTokens,
        total_tokens: summary.totalTokens,
        by_resource_type: byResourceType,
        by_resource: byResourceType,
        by_model: byModel,
        recent_records: recentRecords,
        summary: {
          prompt_tokens: summary.totalPromptTokens,
          completion_tokens: summary.totalCompletionTokens,
          total_tokens: summary.totalTokens,
          processing_duration_seconds: Math.round(summary.totalDurationSeconds * 10) / 10,
          processing_duration_hours: Math.round((summary.totalDurationSeconds / 3600) * 100) / 100,
          total_events: summary.totalEvents,
          window_days: days,
        },
      };

      return res.json({
        success: true,
        message: 'Usage metrics retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }
}
