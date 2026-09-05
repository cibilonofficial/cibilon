import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';

export type DownloadTarget =
  | { kind: 'buffer'; body: Buffer }
  | { kind: 'signed-url'; url: string; expiresIn: number };

export interface DocumentStorage {
  put(key: string, body: Buffer, mimeType: string): Promise<void>;
  delete(key: string): Promise<void>;
  downloadTarget(key: string, originalName: string, mimeType: string): Promise<DownloadTarget>;
}

class LocalDocumentStorage implements DocumentStorage {
  private readonly root = path.resolve(env.LOCAL_STORAGE_PATH);
  private readonly key = Buffer.from(env.DOCUMENT_ENCRYPTION_KEY ?? env.DATA_ENCRYPTION_KEY, 'hex');
  private readonly header = Buffer.from('CIBLON-DOC-V1', 'ascii');

  private resolveKey(key: string) {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Invalid local storage key');
    }
    return target;
  }

  async put(key: string, body: Buffer) {
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
    const encrypted = Buffer.concat([this.header, iv, cipher.getAuthTag(), ciphertext]);
    await writeFile(target, encrypted, { flag: 'wx', mode: 0o600 });
  }

  async delete(key: string) {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }

  async downloadTarget(key: string): Promise<DownloadTarget> {
    const absolutePath = this.resolveKey(key);
    const stored = await readFile(absolutePath);
    if (!stored.subarray(0, this.header.length).equals(this.header)) {
      return { kind: 'buffer', body: stored };
    }
    const ivStart = this.header.length;
    const tagStart = ivStart + 12;
    const contentStart = tagStart + 16;
    const decipher = createDecipheriv('aes-256-gcm', this.key, stored.subarray(ivStart, tagStart));
    decipher.setAuthTag(stored.subarray(tagStart, contentStart));
    return {
      kind: 'buffer',
      body: Buffer.concat([
        decipher.update(stored.subarray(contentStart)),
        decipher.final(),
      ]),
    };
  }
}

class S3DocumentStorage implements DocumentStorage {
  private readonly bucket = env.S3_BUCKET!;
  private readonly client = new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });

  async put(key: string, body: Buffer, mimeType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ServerSideEncryption: env.S3_KMS_KEY_ID ? 'aws:kms' : 'AES256',
        ...(env.S3_KMS_KEY_ID ? { SSEKMSKeyId: env.S3_KMS_KEY_ID } : {}),
      }),
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async downloadTarget(
    key: string,
    originalName: string,
    mimeType: string,
  ): Promise<DownloadTarget> {
    const safeName = originalName.replace(/[\r\n"]/g, '_');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: mimeType,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: env.S3_SIGNED_URL_TTL_SECONDS,
    });
    return { kind: 'signed-url', url, expiresIn: env.S3_SIGNED_URL_TTL_SECONDS };
  }
}

export const documentStorage: DocumentStorage =
  env.STORAGE_DRIVER === 's3' ? new S3DocumentStorage() : new LocalDocumentStorage();
