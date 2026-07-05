import {
  BriefcaseBusiness,
  CircleAlert,
  CircleUserRound,
  CloudUpload,
  FileAudio,
  FileText,
  Pencil,
  Upload,
  UsersRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisInstruction,
  AppPage,
  CallResponse,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  SessionState,
  VisibilityScope
} from "../../types";

import { activeDepartmentLeaderIds, isCompanyManager } from "../../shared/lib/access";
import { callScopeLabel } from "../../shared/lib/formatters";
import { FileDropZone, SelectControl } from "../../shared/ui/primitives";
import { availableInstructionsForContext, InstructionChoiceList, instructionContextHint, InstructionMiniList, StepItem } from "../instructions/instruction-components";

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
  const [title, setTitle] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [scope, setScope] = useState<VisibilityScope>("personal");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(
    departments.find((department) => department.company_uuid === companies[0]?.id)?.id ?? ""
  );
  const [selectedInstructionIds, setSelectedInstructionIds] = useState<string[]>([]);
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

  function toggleInstruction(instructionId: string) {
    setSelectedInstructionIds((current) =>
      current.includes(instructionId)
        ? current.filter((id) => id !== instructionId)
        : [...current, instructionId]
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Введите название звонка.");
      return;
    }

    if (!audio) {
      setError("Выберите аудиофайл.");
      return;
    }

    const payload = {
      title: title.trim(),
      audio,
      companyUuid: scope === "company" || scope === "department" ? companyId : undefined,
      departmentUuid: scope === "department" ? departmentId : undefined,
      useCustomInstructions: selectedInstructionIds.length > 0
    };

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
      const created = await api.createCall(payload);
      onUploaded(created);
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
            <p>Загрузите аудио и укажите, кому принадлежит этот звонок.</p>
          </div>
        </div>
        <StepItem active number="1" title="Файл и принадлежность" text="Загрузите файл и выберите, куда добавить звонок." />
        <StepItem number="2" title="Инструкция для анализа" text="Будет применена подходящая инструкция." />
        <StepItem number="3" title="Обработка и анализ" text="Звонок будет обработан и проанализирован." />
        <StepItem done title="Готово" text="Результаты появятся в обзоре звонка." />
      </aside>

      <form className="upload-form glass" onSubmit={submit}>
        <h1>Загрузить звонок</h1>
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
        <div>
          <span className="field-title">Аудиофайл</span>
          <FileDropZone
            file={audio}
            icon={<FileAudio size={24} />}
            accept=".mp3,.wav,.m4a,.ogg,audio/*"
            buttonLabel="Выбрать аудиофайл"
            emptyLabel="Перетащите аудиофайл сюда"
            onFile={setAudio}
          />
          <small>Поддерживаются: MP3, WAV, M4A, OGG. Максимальный размер: 100 МБ.</small>
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
            {busy ? "Загружаю..." : "Загрузить и поставить в очередь"}
          </button>
          <button className="ghost-button" type="button" onClick={() => onNavigate("calls")}>
            Отмена
          </button>
        </div>
      </form>

    </section>
  );
}
