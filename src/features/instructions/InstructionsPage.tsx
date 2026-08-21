import {
  ArrowLeft,
  Download,
  FileText,
  Plus,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisInstruction,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  SessionState
} from "../../types";

import { activeDepartmentLeaderIds, isCompanyManager } from "../../shared/lib/access";
import { InstructionListSkeleton } from "../../shared/ui/loading";
import { instructionContextLabel } from "./instruction-components";
import { InstructionExample } from "./InstructionExample";

export function InstructionsPage({
  session,
  instructions,
  companies,
  departments,
  departmentMembers,
  loading,
  onBackToSettings
}: {
  session: SessionState;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  departmentMembers: DepartmentMemberResponse[];
  loading: boolean;
  onBackToSettings: () => void;
}) {
  const [localInstructions, setLocalInstructions] = useState(instructions);
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
  const editableDepartments = useMemo(
    () =>
      departments.filter(
        (department) =>
          managedCompanyIds.has(department.company_uuid) || ledDepartmentIds.has(department.id)
      ),
    [departments, ledDepartmentIds, managedCompanyIds]
  );
  const editableDepartmentIds = useMemo(
    () => new Set(editableDepartments.map((department) => department.id)),
    [editableDepartments]
  );
  const personalInstructions = localInstructions.filter((instruction) => instruction.scope === "personal");
  const companyInstructions = localInstructions.filter(
    (instruction) =>
      instruction.scope === "company" &&
      Boolean(instruction.company_uuid && managedCompanyIds.has(instruction.company_uuid))
  );
  const departmentInstructions = localInstructions.filter(
    (instruction) =>
      instruction.scope === "department" &&
      Boolean(instruction.department_uuid && editableDepartmentIds.has(instruction.department_uuid))
  );
  const instructionSections = [
    {
      title: "Личная инструкция",
      instructions: personalInstructions
    },
    {
      title: "Инструкция компании",
      instructions: companyInstructions
    },
    {
      title: "Инструкция Отдела",
      instructions: departmentInstructions
    }
  ].filter((section) => section.instructions.length > 0);

  useEffect(() => {
    setLocalInstructions(instructions);
  }, [instructions]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettingsInstructions() {
      const loaded = (
        await Promise.all([
          api.listInstructions({ scope: "personal", include_inactive: true }).catch(() => []),
          ...managedCompanies.map((company) =>
            api.listInstructions({ scope: "company", company_uuid: company.id, include_inactive: true }).catch(() => [])
          ),
          ...editableDepartments.map((department) =>
            api
              .listInstructions({
                scope: "department",
                company_uuid: department.company_uuid,
                department_uuid: department.id,
                include_inactive: true
              })
              .catch(() => [])
          )
        ])
      ).flat();

      if (!cancelled) setLocalInstructions(loaded);
    }

    loadSettingsInstructions();
    return () => {
      cancelled = true;
    };
  }, [managedCompanies, editableDepartments]);

  return (
    <section className="instructions-layout app-page settings-subpage-layout">
      <div className="settings-back-row">
        <button className="ghost-button small" type="button" onClick={onBackToSettings}>
          <ArrowLeft size={16} />
          Назад
        </button>
      </div>
      <div className="instructions-form glass instructions-list-header">
        <div className="app-page-heading settings-heading compact-heading">
          <span className="settings-heading-icon" aria-hidden="true">
            <FileText size={26} />
          </span>
          <div>
            <h1>Инструкции</h1>
            <p>Инструкция определяет, как AI будет оценивать звонок в выбранном контексте.</p>
          </div>
        </div>
        <div className="instructions-list-header-actions">
          <button className="ghost-button" type="button" onClick={() => { window.history.pushState({}, "", "/app/instructions/new?mode=upload"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
            <Upload size={17} /> Загрузить файл
          </button>
          <button className="primary-button" type="button" onClick={() => { window.history.pushState({}, "", "/app/instructions/new"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
            <Plus size={17} /> Новая инструкция
          </button>
        </div>
        <InstructionExample />
      </div>
      <div className="instructions-list glass">
        <h2>Активные инструкции</h2>
        {loading ? (
          <InstructionListSkeleton count={4} />
        ) : instructionSections.length === 0 ? (
          <div className="instruction-empty standalone">Инструкций пока нет.</div>
        ) : (
          instructionSections.map((section) => (
            <InstructionSection
              key={section.title}
              title={section.title}
              instructions={section.instructions}
              companies={companies}
              departments={departments}
              onInstructionChanged={(updated) =>
                setLocalInstructions((current) => current.map((item) => item.id === updated.id ? updated : item))
              }
              onInstructionDeleted={(instructionId) =>
                setLocalInstructions((current) => current.filter((item) => item.id !== instructionId))
              }
            />
          ))
        )}
      </div>
    </section>
  );
}

export function InstructionSection({
  title,
  instructions,
  companies,
  departments,
  onInstructionChanged,
  onInstructionDeleted
}: {
  title: string;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onInstructionChanged: (instruction: AnalysisInstruction) => void;
  onInstructionDeleted: (instructionId: string) => void;
}) {
  return (
    <section className="instruction-section">
      <div className="instruction-section-title">
        <span />
        <strong>{title}</strong>
        <span />
      </div>
      {instructions.map((instruction) => (
        <InstructionRow
          key={instruction.id}
          instruction={instruction}
          companies={companies}
          departments={departments}
          onInstructionChanged={onInstructionChanged}
          onInstructionDeleted={onInstructionDeleted}
        />
      ))}
    </section>
  );
}

export function InstructionRow({
  instruction,
  companies,
  departments,
  onInstructionChanged,
  onInstructionDeleted
}: {
  instruction: AnalysisInstruction;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onInstructionChanged: (instruction: AnalysisInstruction) => void;
  onInstructionDeleted: (instructionId: string) => void;
}) {
  async function download() {
    const blob = await api.downloadInstruction(instruction.download_url || instruction.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = instruction.original_filename || `${instruction.title}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="instruction-row">
      <button className="instruction-row-link" type="button" onClick={() => { window.history.pushState({}, "", `/app/instructions/${encodeURIComponent(instruction.id)}`); window.dispatchEvent(new PopStateEvent("popstate")); }}>
        <FileText size={20} />
        <strong>{instruction.original_filename}</strong>
      </button>
      <div className="instruction-row-footer">
        <small>
          {instructionContextLabel(instruction, companies, departments)}
        </small>
        <span className={`status-chip ${instruction.is_active ? "ok" : "warn"}`}>
          {instruction.is_active ? "Активна" : "Отключена"}
        </span>
        <div className="panel-actions">
        <button
          className="text-button"
          type="button"
          onClick={async () => {
            const updated = await api.updateInstruction(instruction.id, { is_active: !instruction.is_active });
            onInstructionChanged(updated);
          }}
        >
          {instruction.is_active ? "Отключить" : "Включить"}
        </button>
        <button className="icon-button" type="button" aria-label="Скачать инструкцию" onClick={download}>
          <Download size={16} />
        </button>
        <label className="icon-button" aria-label="Заменить файл">
          <Upload size={16} />
          <input
            type="file"
            accept=".md,.pdf,.docx,.xlsx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const updated = await api.replaceInstructionFile(instruction.id, file);
              onInstructionChanged(updated);
            }}
          />
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Удалить инструкцию"
          onClick={async () => {
            await api.deleteInstruction(instruction.id);
            onInstructionDeleted(instruction.id);
          }}
        >
          <Trash2 size={16} />
        </button>
        </div>
      </div>
    </div>
  );
}
