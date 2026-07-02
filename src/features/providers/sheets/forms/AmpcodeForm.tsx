import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import { IconEye, IconEyeOff, IconPlus, IconX } from '@/components/ui/icons';
import type { AmpcodeConfig, AmpcodeModelMapping, AmpcodeUpstreamApiKeyMapping } from '@/types';
import type { ProviderResource } from '../../types';
import styles from './sharedForm.module.scss';

interface AmpcodeFormState {
  upstreamUrl: string;
  upstreamApiKey: string;
  forceModelMappings: boolean;
  upstreamMappings: Array<{ upstreamApiKey: string; clientKeysText: string }>;
  modelMappings: Array<{ from: string; to: string }>;
}

interface AmpcodeFormProps {
  resource: ProviderResource | null;
  mutating: boolean;
  formId: string;
  onSubmit: (config: AmpcodeConfig) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const emptyUpstream = () => ({ upstreamApiKey: '', clientKeysText: '' });
const emptyModelMapping = () => ({ from: '', to: '' });

const parseClientKeys = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildState = (config?: AmpcodeConfig | null): AmpcodeFormState => {
  const safe = config ?? {};
  return {
    upstreamUrl: safe.upstreamUrl ?? '',
    upstreamApiKey: '',
    forceModelMappings: safe.forceModelMappings === true,
    upstreamMappings: safe.upstreamApiKeys?.length
      ? safe.upstreamApiKeys.map((mapping) => ({
          upstreamApiKey: mapping.upstreamApiKey ?? '',
          clientKeysText: (mapping.apiKeys ?? []).join('\n'),
        }))
      : [emptyUpstream()],
    modelMappings: safe.modelMappings?.length
      ? safe.modelMappings.map((mapping) => ({
          from: mapping.from ?? '',
          to: mapping.to ?? '',
        }))
      : [emptyModelMapping()],
  };
};

export function AmpcodeForm({
  resource,
  mutating,
  formId,
  onSubmit,
  onDirtyChange,
}: AmpcodeFormProps) {
  const { t } = useTranslation();
  const fid = useId();
  const initialConfig = (resource?.raw as AmpcodeConfig | undefined) ?? {};
  const [form, setForm] = useState<AmpcodeFormState>(() => buildState(initialConfig));
  const [initialFormSignature] = useState<string>(() => JSON.stringify(buildState(initialConfig)));
  const [error, setError] = useState<string | null>(null);
  const [showUpstreamApiKey, setShowUpstreamApiKey] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== initialFormSignature,
    [form, initialFormSignature]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);

      const upstreamApiKeys: AmpcodeUpstreamApiKeyMapping[] = [];
      const seenUpstreamKeys = new Set<string>();
      form.upstreamMappings.forEach((mapping) => {
        const upstreamApiKey = mapping.upstreamApiKey.trim();
        if (!upstreamApiKey || seenUpstreamKeys.has(upstreamApiKey)) return;
        const apiKeys = parseClientKeys(mapping.clientKeysText);
        if (!apiKeys.length) return;
        seenUpstreamKeys.add(upstreamApiKey);
        upstreamApiKeys.push({ upstreamApiKey, apiKeys });
      });

      const modelMappings: AmpcodeModelMapping[] = [];
      const seenModels = new Set<string>();
      form.modelMappings.forEach((mapping) => {
        const from = mapping.from.trim();
        const to = mapping.to.trim();
        if (!from || !to) return;
        const key = from.toLowerCase();
        if (seenModels.has(key)) return;
        seenModels.add(key);
        modelMappings.push({ from, to });
      });

      await onSubmit({
        upstreamUrl: form.upstreamUrl.trim() || undefined,
        upstreamApiKey:
          form.upstreamApiKey.trim() || initialConfig.upstreamApiKey?.trim() || undefined,
        upstreamApiKeys: upstreamApiKeys.length ? upstreamApiKeys : undefined,
        modelMappings: modelMappings.length ? modelMappings : undefined,
        forceModelMappings: form.forceModelMappings,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
      <section className={styles.section}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fid}-url`}>
            {t('providersPage.ampcode.upstreamUrl')}
          </label>
          <input
            id={`${fid}-url`}
            className={styles.input}
            value={form.upstreamUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, upstreamUrl: event.target.value }))}
            placeholder="https://api.ampcode.com"
            disabled={mutating}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fid}-key`}>
            {t('providersPage.ampcode.upstreamApiKey')}
            <span className={styles.labelHint}>
              {' '}
              · {t('providersPage.ampcode.upstreamApiKeyHint')}
            </span>
          </label>
          <div className={styles.passwordField}>
            <input
              id={`${fid}-key`}
              className={styles.passwordInput}
              type={showUpstreamApiKey ? 'text' : 'password'}
              value={form.upstreamApiKey}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, upstreamApiKey: event.target.value }))
              }
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
              disabled={mutating}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowUpstreamApiKey((prev) => !prev)}
              disabled={mutating}
              aria-label={
                showUpstreamApiKey
                  ? t('providersPage.form.hideApiKey')
                  : t('providersPage.form.showApiKey')
              }
              title={
                showUpstreamApiKey
                  ? t('providersPage.form.hideApiKey')
                  : t('providersPage.form.showApiKey')
              }
            >
              {showUpstreamApiKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            className={styles.checkboxBox}
            checked={form.forceModelMappings}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, forceModelMappings: event.target.checked }))
            }
            disabled={mutating}
          />
          <span className={styles.checkboxText}>
            <span>{t('providersPage.ampcode.forceModelMappings')}</span>
            <small>{t('providersPage.ampcode.forceModelMappingsHint')}</small>
          </span>
        </label>
      </section>

      <Collapsible label={t('providersPage.ampcode.keyMappingsSection')} defaultOpen>
        <div className={styles.entriesList}>
          {form.upstreamMappings.map((mapping, index) => (
            <div key={index} className={styles.entryCard}>
              <div className={styles.entryCardHeader}>
                <span>{t('providersPage.ampcode.mappingRow', { index: index + 1 })}</span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={mutating || form.upstreamMappings.length <= 1}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      upstreamMappings: prev.upstreamMappings.filter((_, itemIndex) => {
                        return itemIndex !== index;
                      }),
                    }))
                  }
                  aria-label={t('common.delete')}
                >
                  <IconX size={14} />
                  {t('providersPage.actions.delete')}
                </button>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  {t('providersPage.ampcode.upstreamApiKey')}
                </label>
                <input
                  className={styles.input}
                  value={mapping.upstreamApiKey}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      upstreamMappings: prev.upstreamMappings.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, upstreamApiKey: event.target.value } : item
                      ),
                    }))
                  }
                  disabled={mutating}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  {t('providersPage.ampcode.clientKeys')}
                  <span className={styles.labelHint}>
                    {' '}
                    · {t('providersPage.ampcode.clientKeysHint')}
                  </span>
                </label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={mapping.clientKeysText}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      upstreamMappings: prev.upstreamMappings.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, clientKeysText: event.target.value }
                          : item
                      ),
                    }))
                  }
                  disabled={mutating}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className={styles.addBtn}
            disabled={mutating}
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                upstreamMappings: [...prev.upstreamMappings, emptyUpstream()],
              }))
            }
          >
            <IconPlus size={14} />
            {t('providersPage.ampcode.addMapping')}
          </button>
        </div>
      </Collapsible>

      <Collapsible label={t('providersPage.ampcode.modelMappingsSection')}>
        <div className={styles.entriesList}>
          {form.modelMappings.map((mapping, index) => (
            <div key={index} className={styles.modelAliasRow}>
              <input
                className={styles.input}
                placeholder="from"
                value={mapping.from}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    modelMappings: prev.modelMappings.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, from: event.target.value } : item
                    ),
                  }))
                }
                disabled={mutating}
              />
              <input
                className={styles.input}
                placeholder="to"
                value={mapping.to}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    modelMappings: prev.modelMappings.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, to: event.target.value } : item
                    ),
                  }))
                }
                disabled={mutating}
              />
              <button
                type="button"
                className={styles.removeBtn}
                disabled={mutating || form.modelMappings.length <= 1}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    modelMappings: prev.modelMappings.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
                aria-label={t('common.delete')}
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addBtn}
            disabled={mutating}
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                modelMappings: [...prev.modelMappings, emptyModelMapping()],
              }))
            }
          >
            <IconPlus size={14} />
            {t('providersPage.ampcode.addModelMapping')}
          </button>
        </div>
      </Collapsible>

      {error ? <div className={styles.errorBox}>{error}</div> : null}
    </form>
  );
}
