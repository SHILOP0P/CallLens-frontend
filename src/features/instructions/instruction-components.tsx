import {
  Check,
  FileText
} from "lucide-react";
import type {
  AnalysisInstruction,
  CallResponse,
  CompanyResponse,
  DepartmentResponse,
  VisibilityScope
} from "../../types";

import { InstructionListSkeleton } from "../../shared/ui/loading";

export function InstructionChoiceList({
  instructions,
  selectedInstructionIds,
  companies,
  departments,
  loading,
  onToggle
}: {
  instructions: AnalysisInstruction[];
  selectedInstructionIds: string[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading?: boolean;
  onToggle: (instructionId: string) => void;
}) {
  if (loading) {
    return <InstructionListSkeleton count={3} />;
  }

  if (instructions.length === 0) {
    return (
      <div className="instruction-mini-list empty">
        <FileText size={18} />
        <span>Инструкций для выбранного контекста пока нет.</span>
      </div>
    );
  }

  return (
    <div className="instruction-choice-list">
      {instructions.map((instruction) => {
        const selected = selectedInstructionIds.includes(instruction.id);

        return (
          <button
            key={instruction.id}
            type="button"
            className={`instruction-choice ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onToggle(instruction.id)}
          >
            <span className="choice-check">{selected && <Check size={15} />}</span>
            <span>
              <strong>{instruction.title}</strong>
              <small>{instructionContextLabel(instruction, companies, departments)} · {instruction.original_filename}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function InstructionMiniList({
  instructions,
  companies,
  departments,
  title,
  emptyText
}: {
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  title?: string;
  emptyText?: string;
}) {
  if (instructions.length === 0) {
    return (
      <div className="instruction-mini-list empty">
        <FileText size={18} />
        <span>{emptyText ?? "Инструкций пока нет."}</span>
      </div>
    );
  }

  return (
    <div className="instruction-mini-list">
      {title && <strong className="instruction-mini-title">{title}</strong>}
      {instructions.map((instruction) => (
        <div key={instruction.id}>
          <FileText size={18} />
          <span>
            <strong>{instruction.title}</strong>
            <small>{instructionContextLabel(instruction, companies, departments)}</small>
          </span>
          <span className="status-chip ok">Активна</span>
        </div>
      ))}
    </div>
  );
}

export function StepItem({
  number,
  title,
  text,
  active,
  done
}: {
  number?: string;
  title: string;
  text: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className={`step-item ${active ? "active" : ""} ${done ? "done" : ""}`}>
      <span>{done ? <Check size={17} /> : number}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

export function availableInstructionsForContext(
  instructions: AnalysisInstruction[],
  scope: VisibilityScope,
  companyId: string,
  departmentId: string
) {
  if (scope === "department") {
    return instructions.filter(
      (item) =>
        (item.scope === "company" && item.company_uuid === companyId) ||
        (item.scope === "department" && item.department_uuid === departmentId)
    );
  }

  if (scope === "company") {
    return instructions.filter((item) => item.scope === "company" && item.company_uuid === companyId);
  }

  return instructions.filter((item) => item.scope === "personal");
}

export function availableInstructionsForCall(instructions: AnalysisInstruction[], call: CallResponse) {
  return availableInstructionsForContext(
    instructions,
    call.visibility_scope,
    call.company_uuid ?? "",
    call.department_uuid ?? ""
  );
}

export function instructionContextHint(scope: VisibilityScope) {
  if (scope === "personal") {
    return "Личный звонок будет анализироваться только по личным инструкциям.";
  }

  if (scope === "company") {
    return "Звонок компании будет анализироваться по инструкциям выбранной компании.";
  }

  return "Звонок отдела будет анализироваться по инструкциям компании и выбранного отдела.";
}

export function contextInstructionCaption(call?: CallResponse) {
  if (!call) return "Контекст";
  if (call.visibility_scope === "personal") return "Личные";
  if (call.visibility_scope === "company") return "Компания";
  return "Компания + отдел";
}

export function instructionContextLabel(
  instruction: AnalysisInstruction,
  companies: CompanyResponse[],
  departments: DepartmentResponse[]
) {
  if (instruction.scope === "personal") return "Лично";

  const company = companies.find((item) => item.id === instruction.company_uuid)?.name ?? "Компания";
  if (instruction.scope === "company") return `Компания · ${company}`;

  const department =
    departments.find((item) => item.id === instruction.department_uuid)?.name ?? "Отдел";
  return `Отдел · ${company} · ${department}`;
}
