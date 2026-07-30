import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Sheet } from '@/components/ui/Sheet';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useNotificationStore } from '@/stores';
import type {
  PrefixProxyEditorField,
  PrefixProxyEditorFieldValue,
  PrefixProxyEditorState,
} from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import {
  supportsAuthFileUsingApi,
  supportsAuthFileWebsockets,
} from '@/features/authFiles/constants';
import { MAX_CREDENTIAL_WEIGHT } from '@/utils/credentialWeight';
import styles from './AuthFileDetailsSheet.module.scss';

const DERIVED_INFO_KEYS = [
  'successCount',
  'failureCount',
  'recentRequests',
  'runtimeOnly',
  'authIndex',
  'statusMessage',
  'modified',
];

export type AuthFileDetailsSheetProps = {
  disableControls: boolean;
  editor: PrefixProxyEditorState | null;
  updatedText: string;
  dirty: boolean;
  onClose: () => void;
  onCopyText: (text: string) => void | Promise<void>;
  onSave: () => void;
  onChange: (field: PrefixProxyEditorField, value: PrefixProxyEditorFieldValue) => void;
};

const formatJsonText = (text: string): string => {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

export function AuthFileDetailsSheet(props: AuthFileDetailsSheetProps) {
  const { t } = useTranslation();
  const { disableControls, editor, updatedText, dirty, onClose, onCopyText, onSave, onChange } =
    props;
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);

  const confirmClose = useCallback((): boolean | Promise<boolean> => {
    if (!dirty || editor?.saving === true) return true;
    return new Promise<boolean>((resolve) => {
      showConfirmation({
        title: t('providersPage.unsavedChanges.title'),
        message: t('providersPage.unsavedChanges.message'),
        variant: 'danger',
        confirmText: t('providersPage.unsavedChanges.discard'),
        cancelText: t('providersPage.unsavedChanges.keepEditing'),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [dirty, editor?.saving, showConfirmation, t]);

  const handleCancel = useCallback(() => {
    void Promise.resolve(confirmClose()).then((confirmed) => {
      if (confirmed) onClose();
    });
  }, [confirmClose, onClose]);

  const previewText = formatJsonText(updatedText);
  const invalidContentPreview = editor?.invalidContentPreview ?? '';
  const displayInfoText = useMemo(() => {
    const fileInfoText = editor?.fileInfoText ?? '';
    if (!fileInfoText) return '';
    try {
      const parsed = JSON.parse(fileInfoText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        DERIVED_INFO_KEYS.forEach((key) => delete record[key]);
        return JSON.stringify(record, null, 2);
      }
    } catch {
      return fileInfoText;
    }
    return fileInfoText;
  }, [editor?.fileInfoText]);

  return (
    <Sheet
      open={Boolean(editor)}
      onClose={onClose}
      confirmClose={confirmClose}
      size="md"
      closeDisabled={editor?.saving === true}
      eyebrow={t('auth_files.prefix_proxy_button')}
      title={editor?.fileName ?? ''}
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel} disabled={editor?.saving === true}>
            {dirty ? t('common.cancel') : t('common.close')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (updatedText) void onCopyText(updatedText);
            }}
            disabled={editor?.saving === true || !updatedText}
          >
            {t('common.copy')}
          </Button>
          <Button
            onClick={onSave}
            loading={editor?.saving === true}
            disabled={
              disableControls ||
              editor?.saving === true ||
              !dirty ||
              !editor?.json ||
              Boolean(editor?.headersTouched && editor.headersError) ||
              Boolean(editor?.weightError)
            }
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      {editor && (
        <div className={styles.editor}>
          {editor.loading ? (
            <div className={styles.loading}>
              <LoadingSpinner size={14} />
              <span>{t('auth_files.prefix_proxy_loading')}</span>
            </div>
          ) : (
            <>
              {editor.error && <div className={styles.error}>{editor.error}</div>}
              <div className={styles.jsonWrapper}>
                <label className={styles.label}>{t('auth_files.prefix_proxy_info_label')}</label>
                <textarea className={styles.textarea} rows={8} readOnly value={displayInfoText} />
              </div>
              <div className={styles.jsonWrapper}>
                <label className={styles.label}>
                  {editor.json
                    ? t('auth_files.prefix_proxy_source_label')
                    : t('auth_files.prefix_proxy_invalid_content_label')}
                </label>
                {editor.json ? (
                  <textarea className={styles.textarea} rows={10} readOnly value={previewText} />
                ) : (
                  <pre className={styles.invalidPreview}>{invalidContentPreview}</pre>
                )}
              </div>
              {editor.json && (
                <div className={styles.fields}>
                  <Input
                    label={t('auth_files.prefix_label')}
                    value={editor.prefix}
                    disabled={disableControls || editor.saving}
                    onChange={(event) => onChange('prefix', event.target.value)}
                  />
                  <Input
                    label={t('auth_files.proxy_url_label')}
                    value={editor.proxyUrl}
                    placeholder={t('auth_files.proxy_url_placeholder')}
                    disabled={disableControls || editor.saving}
                    onChange={(event) => onChange('proxyUrl', event.target.value)}
                  />
                  <Input
                    label={t('auth_files.priority_label')}
                    value={editor.priority}
                    placeholder={t('auth_files.priority_placeholder')}
                    hint={t('auth_files.priority_hint')}
                    disabled={disableControls || editor.saving}
                    onChange={(event) => onChange('priority', event.target.value)}
                  />
                  <Input
                    label={t('auth_files.weight_label')}
                    type="number"
                    step="1"
                    max={MAX_CREDENTIAL_WEIGHT}
                    value={editor.weight}
                    placeholder="1"
                    hint={t('auth_files.weight_hint')}
                    error={editor.weightError ?? undefined}
                    disabled={disableControls || editor.saving}
                    onChange={(event) => onChange('weight', event.target.value)}
                  />
                  {supportsAuthFileWebsockets(editor.providerKey) && (
                    <div className="form-group">
                      <label>{t('auth_files.websockets_label')}</label>
                      <ToggleSwitch
                        checked={editor.websockets}
                        onChange={(value) => onChange('websockets', value)}
                        disabled={disableControls || editor.saving}
                        ariaLabel={t('auth_files.websockets_label')}
                      />
                      <div className="hint">{t('auth_files.websockets_hint')}</div>
                    </div>
                  )}
                  {supportsAuthFileUsingApi(editor.providerKey) && (
                    <div className="form-group">
                      <label>{t('auth_files.using_api_label')}</label>
                      <ToggleSwitch
                        checked={editor.usingApi}
                        onChange={(value) => onChange('usingApi', value)}
                        disabled={disableControls || editor.saving}
                        ariaLabel={t('auth_files.using_api_label')}
                      />
                      <div className="hint">{t('auth_files.using_api_hint')}</div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>{t('auth_files.headers_label')}</label>
                    <textarea
                      className={`input ${editor.headersError ? styles.textareaInvalid : ''}`}
                      value={editor.headersText}
                      placeholder={t('auth_files.headers_placeholder')}
                      rows={4}
                      aria-invalid={Boolean(editor.headersError)}
                      disabled={disableControls || editor.saving}
                      onChange={(event) => onChange('headersText', event.target.value)}
                    />
                    {editor.headersError && <div className="error-box">{editor.headersError}</div>}
                    <div className="hint">{t('auth_files.headers_hint')}</div>
                  </div>
                  <Input
                    label={t('auth_files.note_label')}
                    value={editor.note}
                    placeholder={t('auth_files.note_placeholder')}
                    hint={t('auth_files.note_hint')}
                    disabled={disableControls || editor.saving}
                    onChange={(event) => onChange('note', event.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
