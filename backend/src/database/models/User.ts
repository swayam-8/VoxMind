import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isActive: boolean;
  isSuperuser: boolean;
  createdAt: Date;
  updatedAt: Date;
  checkPassword(plainText: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isSuperuser: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

function verifyWerkzeugScrypt(hashStr: string, password: string): boolean {
  // Format: scrypt:32768:8:1$salt$hash
  const parts = hashStr.split('$');
  if (parts.length !== 3) return false;
  const [params, salt, expectedHashHex] = parts;
  const paramParts = params.split(':');
  if (paramParts[0] !== 'scrypt') return false;

  const N = parseInt(paramParts[1], 10) || 32768;
  const r = parseInt(paramParts[2], 10) || 8;
  const p = parseInt(paramParts[3], 10) || 1;

  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N,
    r,
    p,
    maxmem: 128 * 1024 * 1024,
  });

  return crypto.timingSafeEqual(Buffer.from(expectedHashHex, 'hex'), derivedKey);
}

UserSchema.methods.checkPassword = async function (plainText: string): Promise<boolean> {
  if (!this.passwordHash) return false;

  // Check if Werkzeug scrypt hash
  if (this.passwordHash.startsWith('scrypt:')) {
    try {
      const match = verifyWerkzeugScrypt(this.passwordHash, plainText);
      if (match) {
        // Transparently upgrade to bcrypt for subsequent fast logins
        const newHash = await bcrypt.hash(plainText, 10);
        this.passwordHash = newHash;
        await this.save();
      }
      return match;
    } catch (_e) {
      return false;
    }
  }

  // Standard bcrypt comparison
  try {
    return await bcrypt.compare(plainText, this.passwordHash);
  } catch (_e) {
    return false;
  }
};

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
