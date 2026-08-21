import DOMPurify from "dompurify";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkChangedLines, remarkObsidianHighlight } from "./markdownPlugins";

type Sheet = { name: string; rows: Array<Array<string | number | boolean | null>> };

export function InstructionDocumentViewer({ filename, blob, markdown, changedLines }: { filename: string; blob?: Blob; markdown?: string; changedLines?: ReadonlyMap<number, "added" | "removed"> }) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "md";
  const [html, setHtml] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [error, setError] = useState("");
  const pdfUrl = useMemo(() => blob && extension === "pdf" ? URL.createObjectURL(blob) : "", [blob, extension]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    setHtml(""); setSheets([]); setSheetIndex(0); setError("");
    if (!blob) return;
    if (extension === "docx") {
      blob.arrayBuffer().then(async (arrayBuffer) => {
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(DOMPurify.sanitize(result.value));
      }).catch(() => { if (!cancelled) setError("Не удалось отобразить DOCX."); });
    }
    if (extension === "xlsx") {
      blob.arrayBuffer().then(async (arrayBuffer) => {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const loaded: Sheet[] = [];
        workbook.eachSheet((worksheet) => {
          const rows: Sheet["rows"] = [];
          worksheet.eachRow({ includeEmpty: true }, (row) => {
            const values: Sheet["rows"][number] = [];
            for (let column = 1; column <= Math.max(worksheet.columnCount, row.cellCount); column += 1) {
              values.push(row.getCell(column).text);
            }
            rows.push(values);
          });
          loaded.push({ name: worksheet.name, rows });
        });
        if (!cancelled) setSheets(loaded);
      }).catch(() => { if (!cancelled) setError("Не удалось отобразить таблицу."); });
    }
    return () => { cancelled = true; };
  }, [blob, extension]);

  if (error) return <div className="form-error" role="alert">{error}</div>;
  if (extension === "pdf" && pdfUrl) return <iframe className="instruction-pdf-viewer" src={pdfUrl} title={filename} />;
  if (extension === "docx") return html ? <div className="instruction-article instruction-docx" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="instruction-document-loading" role="status">Открываю документ…</div>;
  if (extension === "xlsx") {
    const active = sheets[sheetIndex];
    return active ? <div className="instruction-workbook"><div className="instruction-sheet-tabs" role="tablist">{sheets.map((sheet, index) => <button type="button" role="tab" aria-selected={index === sheetIndex} className={index === sheetIndex ? "active" : ""} key={sheet.name} onClick={() => setSheetIndex(index)}>{sheet.name}</button>)}</div><div className="instruction-sheet"><table><tbody>{active.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{String(cell ?? "")}</th> : <td key={cellIndex}>{String(cell ?? "")}</td>)}</tr>)}</tbody></table></div></div> : <div className="instruction-document-loading" role="status">Открываю таблицу…</div>;
  }
  return <article className="instruction-article instruction-markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkObsidianHighlight, ...(changedLines?.size ? [remarkChangedLines(changedLines)] : [])]}>{markdown ?? ""}</ReactMarkdown></article>;
}
