import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { StreamableFile } from '@nestjs/common';
import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let service: any;
  let ctrl: AuditController;

  beforeEach(() => {
    service = {
      list: jest.fn(async () => ({
        items: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })),
      exportCsv: jest.fn(
        async () => 'Timestamp,User,Email,Roles,Action,Entity,Entity ID',
      ),
    };
    ctrl = new AuditController(service);
  });

  it('list delegates the query to the service', async () => {
    const query = { page: 1, limit: 20, order: 'desc', role: 'ADMIN' } as any;
    await ctrl.list(query);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('export delegates the query to the service and returns a CSV StreamableFile', async () => {
    const query = { order: 'desc', from: '2026-07-01' } as any;
    const file = await ctrl.export(query);
    expect(service.exportCsv).toHaveBeenCalledWith(query);
    expect(file).toBeInstanceOf(StreamableFile);
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString('utf-8')).toBe(
      'Timestamp,User,Email,Roles,Action,Entity,Entity ID',
    );
  });
});
