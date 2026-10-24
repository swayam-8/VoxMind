import mongoose, { Schema } from 'mongoose';
const stateSchema = new Schema({
  stateHash: { type: String, required: true, unique: true },
  verifier: { type: String, required: true },
  nonce: { type: String, required: true },
  purpose: { type: String, enum: ['login', 'link'], required: true },
  userId: String,
  tokenVersion: Number,
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const GoogleLoginState = mongoose.model('GoogleLoginState', stateSchema);
const exchangeSchema = new Schema({
  ticketHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  tokenVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const GoogleLoginExchange = mongoose.model('GoogleLoginExchange', exchangeSchema);
