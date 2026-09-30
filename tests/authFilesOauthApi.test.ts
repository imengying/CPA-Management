import { afterEach, describe, expect, test } from 'bun:test';
import { authFilesApi } from '../src/services/api/authFiles';
import { apiClient } from '../src/services/api/client';

const originalGet = apiClient.get;

afterEach(() => {
  apiClient.get = originalGet;
});

describe('auth files API contract', () => {
  test('normalizes account identity fields without deriving from account', async () => {
    apiClient.get = (async () => ({
      files: [
        {
          name: 'vertex-a.json',
          email: '  user@example.com  ',
          project_id: '  project-a  ',
          account: 'sk-live-abcd',
          account_type: 'api_key',
        },
      ],
    })) as typeof apiClient.get;

    const result = await authFilesApi.list();

    expect(result.files[0]).toMatchObject({
      email: 'user@example.com',
      projectId: 'project-a',
      project_id: '  project-a  ',
      account: 'sk-live-abcd',
    });
    expect(result.files[0]?.accountType).toBeUndefined();
  });
});
