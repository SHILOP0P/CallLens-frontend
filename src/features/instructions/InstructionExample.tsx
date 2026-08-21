import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { InstructionDocumentViewer } from "./InstructionDocumentViewerV2";

const exampleMarkdown = `# Контроль следующего шага

## Цель
Проверить, договорились ли участники о конкретном продолжении.

## Критерии
- Названо следующее действие.
- Указан ответственный.
- Указан срок.

## Доказательства
Используй только точные цитаты из разговора.

## Рекомендация
Если договорённость неполная, укажи, чего именно не хватает.`;

export function InstructionExample() {
  const [open, setOpen] = useState(false);
  return <section className={`instruction-template-example${open ? " open" : ""}`}>
    <button className="instruction-template-example-toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <ChevronRight size={18}/><span>Пример эффективной инструкции</span>
    </button>
    <div className="instruction-template-example-collapse" aria-hidden={!open}>
      <div className="instruction-template-example-collapse-inner">
        <div className="instruction-template-example-content"><InstructionDocumentViewer filename="example.md" markdown={exampleMarkdown}/></div>
      </div>
    </div>
  </section>;
}
