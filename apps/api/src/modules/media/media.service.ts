import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as net from 'net';

@Injectable()
export class MediaService {
  private minioClient: Minio.Client;
  private readonly logger = new Logger(MediaService.name);
  private readonly bucketName: string;
  private readonly enableVirusScan: boolean;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>(
      'MINIO_BUCKET_NAME',
      'capacity-connect-media',
    );
    this.enableVirusScan =
      this.configService.get<string>('ENABLE_VIRUS_SCAN') === 'true';

    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.configService.get<number>('MINIO_PORT', 9000)),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async scanBufferForVirus(buffer: Buffer): Promise<boolean> {
    if (!this.enableVirusScan) return true;

    const host = this.configService.get<string>('CLAMAV_HOST', 'localhost');
    const port = Number(this.configService.get<number>('CLAMAV_PORT', 3310));

    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.connect(port, host, () => {
        socket.write('zINSTREAM\0');
        let offset = 0;
        const chunkSize = 2048;

        while (offset < buffer.length) {
          const chunk = buffer.subarray(offset, offset + chunkSize);
          const sizeBuffer = Buffer.alloc(4);
          sizeBuffer.writeUInt32BE(chunk.length, 0);
          socket.write(sizeBuffer);
          socket.write(chunk);
          offset += chunkSize;
        }

        const zeroBuffer = Buffer.alloc(4);
        zeroBuffer.writeUInt32BE(0, 0);
        socket.write(zeroBuffer);
      });

      socket.on('data', (data) => {
        const response = data.toString('utf-8');
        socket.destroy();
        resolve(response.includes('OK'));
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(true); // Don't block upload if ClamAV daemon is absent locally
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(true);
      });
    });
  }

  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    folder = 'library',
  ): Promise<{ fileUrl: string; objectKey: string; size: number }> {
    const isClean = await this.scanBufferForVirus(file.buffer);
    if (!isClean) {
      throw new BadRequestException('Security threat detected in file');
    }

    const bucketExists = await this.minioClient.bucketExists(this.bucketName).catch(() => false);
    if (!bucketExists) {
      await this.minioClient.makeBucket(this.bucketName, 'us-east-1').catch(() => null);
    }

    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `${folder}/${Date.now()}-${sanitizedName}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return {
      fileUrl: `/api/v1/media/${objectKey}`,
      objectKey,
      size: file.size,
    };
  }

  async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.bucketName, objectKey, expirySeconds);
    } catch {
      return `/api/v1/media/${objectKey}`;
    }
  }
}

