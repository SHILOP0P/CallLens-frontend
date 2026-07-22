import {
  BriefcaseBusiness,
  CircleAlert,
  CircleUserRound,
  CloudUpload,
  FileAudio,
  FileVideo,
  FileText,
  Pencil,
  Upload,
  UsersRound,
  X
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisInstruction,
  AppPage,
  CallFolderResponse,
  CallResponse,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  PromptTopic,
  SessionState,
  VisibilityScope
} from "../../types";

import { activeDepartmentLeaderIds, isCompanyManager } from "../../shared/lib/access";
import { callScopeLabel } from "../../shared/lib/formatters";
import { FileDropZone, SelectControl } from "../../shared/ui/primitives";
import { availableInstructionsForContext, InstructionChoiceList, instructionContextHint, InstructionMiniList, StepItem } from "../instructions/instruction-components";
import { PromptContextSelector } from "./PromptContextSelector";

const maxBatchFiles = 10;
const mediaAccept = ".mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm,.mkv,audio/*,video/mp4,video/quicktime,video/webm,video/x-matroska";
const uploadModeStorageKey = "calllens-upload-mode";

type UploadMode = "single" | "multiple";
type BatchUploadItem = {
  id: string;
  file: File;
  title: string;
  status: "pending" | "uploading" | "success" | "failed";
  error?: string;
};

export function UploadPage({
  session,
  companies,
  departments,
  departmentMembers,
  instructions,
  loading,
  onNavigate,
  onUploaded
}: {
  session: SessionState;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  departmentMembers: DepartmentMemberResponse[];
  instructions: AnalysisInstruction[];
  loading: boolean;
  onNavigate: (page: AppPage) => void;
  onUploaded: (call: CallResponse) => void;
}) {
  const [uploadMode, setUploadMode] = useState<UploadMode>(readStoredUploadMode);
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [batchItems, setBatchItems] = useState<BatchUploadItem[]>([]);
  const [batchDragActive, setBatchDragActive] = useState(false);
  const [scope, setScope] = useState<VisibilityScope>("personal");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(
    departments.find((department) => department.company_uuid === companies[0]?.id)?.id ?? ""
  );
  const [callFolders, setCallFolders] = useState<CallFolderResponse[]>([]);
  const [folderId, setFolderId] = useState("");
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [selectedInstructionIds, setSelectedInstructionIds] = useState<string[]>([]);
  const [promptTopics, setPromptTopics] = useState<PromptTopic[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const managedCompanies = useMemo(
    () => companies.filter((company) => isCompanyManager(company, session.user.id)),
    [companies, session.user.id]
  );
  const managedCompanyIds = useMemo(
    () => new Set(managedCompanies.map((company) => company.id)),
    [managedCompanies]
  );
  const ledDepartmentIds = useMemo(
    () => activeDepartmentLeaderIds(departmentMembers, session.user.id),
    [departmentMembers, session.user.id]
  );
  const accessibleDepartments = useMemo(
    () =>
      departments.filter(
        (department) =>
          managedCompanyIds.has(department.company_uuid) || ledDepartmentIds.has(department.id)
      ),
    [departments, ledDepartmentIds, managedCompanyIds]
  );
  const companiesWithAccessibleDepartments = useMemo(
    () =>
      companies.filter((company) =>
        accessibleDepartments.some((department) => department.company_uuid === company.id)
      ),
    [accessibleDepartments, companies]
  );
  const availableCallScopes = useMemo<VisibilityScope[]>(
    () => [
      "personal",
      ...(managedCompanies.length > 0 ? (["company"] as VisibilityScope[]) : []),
      ...(accessibleDepartments.length > 0 ? (["department"] as VisibilityScope[]) : [])
    ],
    [accessibleDepartments.length, managedCompanies.length]
  );
  const selectableCompanies = scope === "department" ? companiesWithAccessibleDepartments : managedCompanies;
  const availableDepartments = accessibleDepartments.filter((department) => department.company_uuid === companyId);
  const availableInstructions = availableInstructionsForContext(
    instructions,
    scope,
    companyId,
    departmentId
  );
  const availableInstructionKey = availableInstructions.map((instruction) => instruction.id).join("|");
  const selectedInstructions = availableInstructions.filter((instruction) =>
    selectedInstructionIds.includes(instruction.id)
  );

  useEffect(() => {
    if (!availableCallScopes.includes(scope)) {
      setScope("personal");
    }
  }, [availableCallScopes, scope]);

  useEffect(() => {
    try {
      window.localStorage.setItem(uploadModeStorageKey, uploadMode);
    } catch {
      // The upload mode remains available for the current page when storage is unavailable.
    }
  }, [uploadMode]);

  useEffect(() => {
    if (scope === "personal") return;

    if (!selectableCompanies.some((company) => company.id === companyId)) {
      setCompanyId(selectableCompanies[0]?.id ?? "");
    }
  }, [companyId, scope, selectableCompanies]);

  useEffect(() => {
    if (scope !== "department") return;

    if (!availableDepartments.some((department) => department.id === departmentId)) {
      setDepartmentId(availableDepartments[0]?.id ?? "");
    }
  }, [availableDepartments, departmentId, scope]);

  useEffect(() => {
    setSelectedInstructionIds((current) => {
      const availableIds = availableInstructions.map((instruction) => instruction.id);
      const available = new Set(availableIds);
      const preserved = current.filter((id) => available.has(id));

      return preserved.length > 0 ? preserved : availableIds;
    });
  }, [availableInstructionKey]);

  useEffect(() => {
    const filters = folderFiltersForUpload(scope, companyId, departmentId);
    if (!filters) {
      setCallFolders([]);
      setFolderId("");
      setFoldersLoading(false);
      setFolderError("");
      return;
    }

    let cancelled = false;
    setFoldersLoading(true);
    setFolderError("");

    api
      .listCallFolders({ ...filters, limit: 100, offset: 0 })
      .then((response) => {
        if (cancelled) return;
        setCallFolders(response.items);
        setFolderId((current) => response.items.some((folder) => folder.id === current) ? current : "");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setCallFolders([]);
        setFolderId("");
        setFolderError(loadError instanceof Error ? loadError.message : "Не удалось загрузить папки.");
      })
      .finally(() => {
        if (!cancelled) setFoldersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, departmentId, scope]);

  function toggleInstruction(instructionId: string) {
    setSelectedInstructionIds((current) =>
      current.includes(instructionId)
        ? current.filter((id) => id !== instructionId)
        : [...current, instructionId]
    );
  }

  function selectBatchFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length === 0) return;

    const knownFiles = new Set(batchItems.map((item) => batchFileKey(item.file)));
    const newFiles = selected.filter((file) => {
      const key = batchFileKey(file);
      if (knownFiles.has(key)) return false;
      knownFiles.add(key);
      return true;
    });
    if (newFiles.length === 0) return;

    if (batchItems.length + newFiles.length > maxBatchFiles) {
      setError(`Всего можно выбрать не более ${maxBatchFiles} звонков.`);
      return;
    }

    setError("");
    setBatchItems((items) => [...items, ...newFiles.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${Date.now()}-${index}`,
      file,
      title: titleFromFilename(file.name),
      status: "pending" as const
    }))]);
  }

  function handleBatchDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setBatchDragActive(event.type === "dragenter" || event.type === "dragover");
  }

  function handleBatchDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setBatchDragActive(false);
    selectBatchFiles(event.dataTransfer.files);
  }

  function updateBatchItem(id: string, update: Partial<Pick<BatchUploadItem, "title" | "status" | "error">>) {
    setBatchItems((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (uploadMode === "single" && !title.trim()) {
      setError("Введите название звонка.");
      return;
    }

    if (uploadMode === "single" && !media) {
      setError("Выберите аудио- или видеофайл.");
      return;
    }

    if (uploadMode === "multiple" && (batchItems.length === 0 || batchItems.length > maxBatchFiles)) {
      setError(`Выберите от 1 до ${maxBatchFiles} аудио- или видеофайлов.`);
      return;
    }

    if ((scope === "company" || scope === "department") && !companyId) {
      setError("Выберите компанию.");
      return;
    }

    if (scope === "department" && !departmentId) {
      setError("Выберите отдел.");
      return;
    }

    setBusy(true);
    try {
      const sharedInput = {
        companyUuid: scope === "company" || scope === "department" ? companyId : undefined,
        departmentUuid: scope === "department" ? departmentId : undefined,
        useCustomInstructions: selectedInstructionIds.length > 0
      };
      if (uploadMode === "single" && media) {
        const created = await api.createCall({ ...sharedInput, title: title.trim(), media });
        if (promptTopics.length > 0) await api.putCallPromptContext(created.id, { topic_keys: promptTopics.map((topic) => topic.key) });
        if (folderId) await api.assignCallToFolder(folderId, created.id);
        onUploaded(created);
      } else {
        const queue = [...batchItems];
        const results: boolean[] = [];
        const uploadBatchItem = async (item: BatchUploadItem) => {
          updateBatchItem(item.id, { status: "uploading", error: undefined });
          try {
            const created = await api.createCall({ ...sharedInput, title: item.title.trim() || undefined, media: item.file });
            if (promptTopics.length > 0) await api.putCallPromptContext(created.id, { topic_keys: promptTopics.map((topic) => topic.key) });
            if (folderId) await api.assignCallToFolder(folderId, created.id);
            onUploaded(created);
            updateBatchItem(item.id, { status: "success" });
            return true;
          } catch (uploadError) {
            updateBatchItem(item.id, {
              status: "failed",
              error: uploadError instanceof Error ? uploadError.message : "Не удалось загрузить звонок."
            });
            return false;
          }
        };
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (queue.length > 0) {
            const item = queue.shift();
            if (item) results.push(await uploadBatchItem(item));
          }
        }));
        const failed = results.filter((result) => !result).length;
        if (failed > 0) setError(`Не удалось загрузить ${failed} из ${batchItems.length} звонков. Их можно повторить.`);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить звонок");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="upload-layout">
      <aside className="step-rail glass">
        <div className="step-rail-title">
          <Upload size={28} />
          <div>
            <h2>Загрузка звонка</h2>
            <p>Загрузите аудио или видео и укажите, кому принадлежит этот звонок.</p>
          </div>
        </div>
        <StepItem active number="1" title="Файл и принадлежность" text="Загрузите файл и выберите, куда добавить звонок." />
        <StepItem number="2" title="Инструкция для анализа" text="Будет применена подходящая инструкция." />
        <StepItem number="3" title="Обработка и анализ" text="Звонок будет обработан и проанализирован." />
        <StepItem done title="Готово" text="Результаты появятся в обзоре звонка." />
      </aside>

      <form className="upload-form glass" onSubmit={submit}>
        <h1>Загрузить звонок</h1>
        <div>
          <span className="field-title">Режим загрузки</span>
          <div className="segmented scope">
            <button type="button" className={uploadMode === "single" ? "active" : ""} disabled={busy} onClick={() => setUploadMode("single")}>
              Один звонок
            </button>
            <button type="button" className={uploadMode === "multiple" ? "active" : ""} disabled={busy} onClick={() => setUploadMode("multiple")}>
              Несколько звонков
            </button>
          </div>
        </div>
        {uploadMode === "single" && (
          <label>
            Название звонка
            <div className="input-with-counter">
              <input
                value={title}
                maxLength={255}
                required
                placeholder="Например: обсуждение условий договора с клиентом"
                onChange={(event) => setTitle(event.target.value)}
              />
              <span>{title.length} / 255</span>
            </div>
          </label>
        )}
        <div>
          <span className="field-title">{uploadMode === "single" ? "Запись звонка" : `Записи звонков (до ${maxBatchFiles})`}</span>
          {uploadMode === "single" ? (
            <FileDropZone
              file={media}
              icon={media?.type.startsWith("video/") ? <FileVideo size={24} /> : <FileAudio size={24} />}
              accept={mediaAccept}
              buttonLabel="Выбрать запись"
              emptyLabel="Перетащите аудио или видео сюда"
              onFile={setMedia}
            />
          ) : (
            <label
              className={`file-dropzone ${batchDragActive ? "dragging" : ""}`}
              onDragEnter={handleBatchDrag}
              onDragOver={handleBatchDrag}
              onDragLeave={handleBatchDrag}
              onDrop={handleBatchDrop}
            >
              <input
                type="file"
                multiple
                accept={mediaAccept}
                disabled={busy}
                onChange={(event) => {
                  selectBatchFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="file-dropzone-icon"><FileAudio size={24} /></span>
              <span className="file-dropzone-copy">
                <strong>{batchItems.length ? `Выбрано файлов: ${batchItems.length}` : "Выберите до 10 файлов"}</strong>
                <small>Для каждого автоматически будет задано название из имени файла.</small>
              </span>
              <span className="ghost-button file-dropzone-button">Выбрать файлы</span>
            </label>
          )}
          <small>Аудио: MP3, WAV, M4A, OGG. Видео: MP4, MOV, WEBM, MKV. Максимальный размер: 100 МБ.</small>
          {uploadMode === "multiple" && batchItems.length > 0 && (
            <div className="batch-upload-list">
              {batchItems.map((item) => (
                <div className={`batch-upload-item ${item.status}`} key={item.id}>
                  <FileAudio size={17} />
                  <span title={item.file.name}>{item.file.name}</span>
                  <input aria-label={`Название ${item.file.name}`} value={item.title} maxLength={255} disabled={busy} onChange={(event) => updateBatchItem(item.id, { title: event.target.value })} />
                  <small>{batchStatusLabel(item)}</small>
                  {!busy && <button className="icon-button" type="button" aria-label={`Удалить ${item.file.name}`} onClick={() => setBatchItems((items) => items.filter((current) => current.id !== item.id))}><X size={16} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="field-title">Куда добавить звонок?</span>
          <div className="segmented scope">
            {availableCallScopes.map((item) => (
              <button
                type="button"
                key={item}
                className={scope === item ? "active" : ""}
                onClick={() => setScope(item)}
              >
                {item === "personal" && <CircleUserRound size={17} />}
                {item === "company" && <BriefcaseBusiness size={17} />}
                {item === "department" && <UsersRound size={17} />}
                {callScopeLabel(item)}
              </button>
            ))}
          </div>
        </div>
        {scope !== "personal" && (
          <div className="form-grid two">
            <label>
              Компания
              <SelectControl value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {selectableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            {scope === "department" && (
              <label>
                Отдел
                <SelectControl value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {availableDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectControl>
              </label>
            )}
          </div>
        )}
        <div className="upload-folder-field">
          <span className="field-title">Папка</span>
          <SelectControl
            aria-label="Папка для звонка"
            value={folderId}
            disabled={foldersLoading}
            onChange={(event) => setFolderId(event.target.value)}
          >
            <option value="">Без папки</option>
            {callFolders.map((folder) => (
              <option key={folder.id} value={folder.id} data-color={folder.color || "#ff7a43"}>
                {folder.name}
              </option>
            ))}
          </SelectControl>
          <small>
            {foldersLoading
              ? "Загружаю папки..."
              : callFolders.length > 0
                ? "Можно сразу положить звонок в папку выбранной области."
                : "Для выбранной области пока нет папок."}
          </small>
          {folderError && <div className="form-error compact">{folderError}</div>}
        </div>
        <PromptContextSelector
          disabled={busy}
          onChange={setPromptTopics}
        />
        <div className="context-note">
          <CircleAlert size={18} />
          <span>
            Выбранный контекст определяет, кто сможет просматривать звонок и какая инструкция
            будет использована для анализа.
          </span>
        </div>
        <div className="instruction-preview">
          <FileText size={21} />
          <div>
            <strong>Инструкции для выбранного контекста</strong>
            <small>{instructionContextHint(scope)}</small>
          </div>
          <button className="ghost-button small" type="button" onClick={() => onNavigate("settingsInstructions")}>
            <Pencil size={15} />
            Изменить инструкцию
          </button>
        </div>
        <InstructionChoiceList
          instructions={availableInstructions}
          selectedInstructionIds={selectedInstructionIds}
          companies={companies}
          departments={departments}
          loading={loading}
          onToggle={toggleInstruction}
        />
        <InstructionMiniList
          title="Выбрано для анализа"
          instructions={selectedInstructions}
          companies={companies}
          departments={departments}
          emptyText="Инструкции не выбраны."
        />
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            <CloudUpload size={18} />
            {busy ? "Загружаю..." : uploadMode === "multiple" ? "Загрузить всё и поставить в очередь" : "Загрузить и поставить в очередь"}
          </button>
          <button className="ghost-button" type="button" onClick={() => onNavigate("calls")}>
            Отмена
          </button>
        </div>
      </form>

    </section>
  );
}

function folderFiltersForUpload(
  scope: VisibilityScope,
  companyId: string,
  departmentId: string
) {
  if (scope === "personal") {
    return { scope };
  }

  if (scope === "company") {
    return companyId ? { scope, company_uuid: companyId } : null;
  }

  return companyId && departmentId
    ? { scope, company_uuid: companyId, department_uuid: departmentId }
    : null;
}

function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || "Звонок";
}

function batchFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function readStoredUploadMode(): UploadMode {
  try {
    return window.localStorage.getItem(uploadModeStorageKey) === "multiple" ? "multiple" : "single";
  } catch {
    return "single";
  }
}

function batchStatusLabel(item: BatchUploadItem) {
  if (item.status === "uploading") return "Загружается";
  if (item.status === "success") return "Поставлен в очередь";
  if (item.status === "failed") return item.error ?? "Ошибка загрузки";
  return "Готов к загрузке";
}
