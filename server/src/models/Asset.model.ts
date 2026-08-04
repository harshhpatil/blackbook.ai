import mongoose, { Document, Schema } from 'mongoose';

export type AssetKind = 'template' | 'source' | 'export-docx' | 'export-pdf';

export interface IAsset extends Document {
  owner: mongoose.Types.ObjectId;
  project?: mongoose.Types.ObjectId;
  key: string;
  kind: AssetKind;
  originalFilename: string;
  contentType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    key: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ['template', 'source', 'export-docx', 'export-pdf'],
      required: true,
      index: true,
    },
    originalFilename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

AssetSchema.index({ owner: 1, createdAt: -1 });
AssetSchema.index({ project: 1, kind: 1, createdAt: -1 });

export const Asset = mongoose.model<IAsset>('Asset', AssetSchema);
