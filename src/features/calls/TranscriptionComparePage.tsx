import { ArrowLeft, Check, ChevronDown, GitCompareArrows, Plus, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { flushSync } from "react-dom";
import { api } from "../../api";
import type {
  CallResponse,
  TranscriptionRevisionContent,
  TranscriptionRevisionSummary,
  TranscriptionSpeakerAssignment,
  TranscriptionWordResponse
} from "../../types";
import { formatDate, transcriptionSpeakerLabel } from "../../shared/lib/formatters";

const VERSION_COLORS = ["#ff8058", "#66a8ff", "#b58cff", "#57c7a1", "#e6b85c"];
const MAX_COMPARED_VERSIONS = VERSION_COLORS.length;

type LoadedVersions = Record<number, TranscriptionRevisionContent>;
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};
type CompareLane = number;
type WordChange = {
  kind: "speaker" | "replace" | "add" | "remove" | "speaker-and-replace";
  startIndex: number;
  endIndex: number;
  startSeconds?: number;
  endSeconds?: number;
  before: string;
  after: string;
  speakerBefore: string;
  speakerAfter: string;
};

export function TranscriptionComparePage({
  call,
  initialRevision,
  onBack
}: {
  call?: CallResponse;
  initialRevision?: number;
  onBack: () => void;
}) {
  const [revisions, setRevisions] = useState<TranscriptionRevisionSummary[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [contents, setContents] = useState<LoadedVersions>({});
  const [versionColors, setVersionColors] = useState<Record<number, string>>({});
  const [versionLanes, setVersionLanes] = useState<Record<number, CompareLane>>({});
  const [draggingRevision, setDraggingRevision] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ lane: CompareLane; index: number; columnPlacement?: "before" | "after"; newColumnIndex?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [speakerAssignments, setSpeakerAssignments] = useState<TranscriptionSpeakerAssignment[]>([]);
  const selectedKey = selected.join(",");
  const laneKey = selected.map((revision) => `${revision}:${versionLanes[revision] ?? 0}`).join(",");
  const addVersionRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef(new Map<number, HTMLElement>());
  const cardRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (!call) return;
    let cancelled = false;
    setLoading(true); setError(""); setContents({});
    void api.listTranscriptionRevisions(call.id, 100, 0).then(async (history) => {
      if (cancelled) return;
      const ordered = [...history.items].sort((a, b) => a.revision - b.revision);
      setRevisions(ordered);
      const current = ordered.find((item) => item.is_current)?.revision ?? ordered.at(-1)?.revision;
      const queryVersions = (new URLSearchParams(window.location.search).get("versions") ?? "")
        .split(",").map(Number).filter((revision) => Number.isInteger(revision) && ordered.some((item) => item.revision === revision));
      const requested = ordered.some((item) => item.revision === initialRevision) ? initialRevision : undefined;
      const previous = [...ordered].reverse().find((item) => item.revision !== (requested ?? current))?.revision;
      const fallback = Array.from(new Set([requested, previous, current].filter((value): value is number => value !== undefined))).sort((a, b) => a - b);
      const initial = (queryVersions.length >= 2 ? Array.from(new Set(queryVersions)) : fallback).slice(0, MAX_COMPARED_VERSIONS);
      setSelected(initial);
      setVersionColors(Object.fromEntries(initial.map((revision, index) => [revision, VERSION_COLORS[index]])));
      const savedLayout = new Map((new URLSearchParams(window.location.search).get("layout") ?? "").split(",").map((item) => item.split(":").map(Number)).filter(([revision, lane]) => initial.includes(revision) && Number.isInteger(lane) && lane >= 0 && lane < MAX_COMPARED_VERSIONS) as Array<[number, CompareLane]>);
      const savedLaneIds = Array.from(new Set(savedLayout.values())).sort((a, b) => a - b);
      setVersionLanes(Object.fromEntries(initial.map((revision, index) => {
        const savedLane = savedLayout.get(revision);
        return [revision, savedLane === undefined ? defaultLane(index, initial.length) : savedLaneIds.indexOf(savedLane)];
      })));
      const loaded = await Promise.all(initial.map((revision) => api.getTranscriptionRevision(call.id, revision)));
      if (!cancelled) setContents(Object.fromEntries(loaded.map((content) => [content.revision, content])));
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Не удалось загрузить версии транскрипции");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [call?.id, initialRevision]);

  useEffect(() => {
    if (!call) { setSpeakerAssignments([]); return; }
    let cancelled = false;
    void api.listTranscriptionSpeakerAssignments(call.id)
      .then((items) => { if (!cancelled) setSpeakerAssignments(items); })
      .catch(() => { if (!cancelled) setSpeakerAssignments([]); });
    return () => { cancelled = true; };
  }, [call?.id]);

  useEffect(() => {
    if (!call || selected.length === 0) return;
    const query = new URLSearchParams(window.location.search);
    query.set("call", call.id);
    query.set("versions", selected.join(","));
    query.set("layout", selected.map((revision) => `${revision}:${versionLanes[revision] ?? 0}`).join(","));
    query.delete("version");
    window.history.replaceState({}, "", `/app/calls/transcription-compare?${query}`);
  }, [call?.id, selectedKey, laneKey]);

  useEffect(() => {
    if (!adding) return;
    function closeOnPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !addVersionRef.current?.contains(event.target)) setAdding(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdding(false);
        addVersionRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [adding]);

  async function addVersion(revision: number) {
    if (!call || selected.includes(revision) || selected.length >= MAX_COMPARED_VERSIONS) return;
    setError("");
    try {
      const content = contents[revision] ?? await api.getTranscriptionRevision(call.id, revision);
      setContents((current) => ({ ...current, [revision]: content }));
      const usedColors = new Set(selected.map((item) => versionColors[item]));
      setVersionColors((current) => ({ ...current, [revision]: VERSION_COLORS.find((color) => !usedColors.has(color)) ?? VERSION_COLORS[0] }));
      const laneIds = activeLaneIds(selected, versionLanes);
      const lane = laneIds.reduce((least, candidate) => countLane(selected, versionLanes, candidate) < countLane(selected, versionLanes, least) ? candidate : least, laneIds[0] ?? 0);
      updateSelectedWithAnimation([...selected, revision], { ...versionLanes, [revision]: lane });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось добавить версию");
    }
  }

  async function toggleVersion(revision: number) {
    if (selected.includes(revision)) {
      if (selected.length <= 2) return;
      updateSelectedWithAnimation(selected.filter((item) => item !== revision));
      return;
    }
    await addVersion(revision);
  }

  function updateSelectedWithAnimation(next: number[], nextLanes = versionLanes) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      flushSync(() => { setSelected(next); setVersionLanes(nextLanes); });
      return;
    }
    const transitionDocument = document as ViewTransitionDocument;
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(() => { setSelected(next); setVersionLanes(nextLanes); })).finished.catch(() => undefined);
      return;
    }
    const elements = [...chipRefs.current.values(), ...cardRefs.current.values()];
    const before = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
    flushSync(() => { setSelected(next); setVersionLanes(nextLanes); });
    for (const element of elements) {
      if (!element.isConnected) continue;
      const first = before.get(element); const last = element.getBoundingClientRect();
      if (!first) continue;
      const deltaX = first.left - last.left; const deltaY = first.top - last.top;
      const scaleX = last.width > 0 ? first.width / last.width : 1;
      const scaleY = last.height > 0 ? first.height / last.height : 1;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1 && Math.abs(scaleX - 1) < .005 && Math.abs(scaleY - 1) < .005) continue;
      element.animate([{ transformOrigin: "top left", transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})` }, { transformOrigin: "top left", transform: "translate(0, 0) scale(1, 1)" }], { duration: 480, easing: "cubic-bezier(.16,1,.3,1)" });
    }
  }

  function updateDropTarget(event: DragEvent<HTMLDivElement>, lane: CompareLane) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const laneRect = event.currentTarget.getBoundingClientRect();
    const horizontalPosition = (event.clientX - laneRect.left) / laneRect.width;
    const sourceLane = draggingRevision === null ? lane : (versionLanes[draggingRevision] ?? 0);
    const columnPlacement: "before" | "after" | undefined = lane !== sourceLane && horizontalPosition < .22 ? "before" : lane !== sourceLane && horizontalPosition > .78 ? "after" : undefined;
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>(".compare-version-card:not(.is-dragging)")];
    const index = cards.findIndex((card) => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
    const next = { lane, index: index < 0 ? cards.length : index, columnPlacement };
    if (!dropTarget || dropTarget.lane !== next.lane || dropTarget.index !== next.index || dropTarget.columnPlacement !== next.columnPlacement) setDropTarget(next);
  }

  function dropVersion(event: DragEvent<HTMLDivElement>, lane: CompareLane) {
    event.preventDefault();
    if (draggingRevision === null) return;
    if (dropTarget?.lane === lane && dropTarget.columnPlacement) {
      const sourceLane = versionLanes[draggingRevision] ?? 0;
      const groups = activeLaneIds(selected, versionLanes).map((laneId) => ({
        laneId,
        revisions: selected.filter((revision) => (versionLanes[revision] ?? 0) === laneId)
      }));
      const sourceGroupIndex = groups.findIndex((group) => group.laneId === sourceLane);
      const [sourceGroup] = groups.splice(sourceGroupIndex, 1);
      const targetRevision = selected.find((revision) => revision !== draggingRevision && (versionLanes[revision] ?? 0) === lane);
      const targetIndex = targetRevision === undefined ? groups.length : groups.findIndex((group) => group.revisions.includes(targetRevision));
      const insertionIndex = targetIndex < 0 ? groups.length : targetIndex + (dropTarget.columnPlacement === "after" ? 1 : 0);
      groups.splice(insertionIndex, 0, sourceGroup);
      const normalizedLanes = { ...versionLanes };
      groups.forEach((group, laneIndex) => group.revisions.forEach((revision) => { normalizedLanes[revision] = laneIndex; }));
      updateSelectedWithAnimation(groups.flatMap((group) => group.revisions), normalizedLanes);
      setDraggingRevision(null); setDropTarget(null);
      return;
    }
    const nextLanes = { ...versionLanes, [draggingRevision]: lane };
    const remaining = selected.filter((revision) => revision !== draggingRevision);
    const laneIds = Array.from(new Set([...remaining.map((revision) => nextLanes[revision] ?? 0), lane])).sort((a, b) => a - b);
    const laneVersions = new Map(laneIds.map((laneId) => [laneId, remaining.filter((revision) => (nextLanes[revision] ?? 0) === laneId)]));
    const target = laneVersions.get(lane) ?? [];
    target.splice(Math.min(dropTarget?.lane === lane ? dropTarget.index : target.length, target.length), 0, draggingRevision);
    laneVersions.set(lane, target);
    const populated = laneIds.filter((laneId) => (laneVersions.get(laneId)?.length ?? 0) > 0);
    const normalizedLanes = { ...nextLanes };
    populated.forEach((laneId, index) => laneVersions.get(laneId)?.forEach((revision) => { normalizedLanes[revision] = index; }));
    updateSelectedWithAnimation(populated.flatMap((laneId) => laneVersions.get(laneId) ?? []), normalizedLanes);
    setDraggingRevision(null); setDropTarget(null);
  }

  function dropAsNewColumn(event: DragEvent<HTMLDivElement>, requestedIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    if (draggingRevision === null) return;
    const sourceLane = versionLanes[draggingRevision] ?? 0;
    const groups = activeLaneIds(selected, versionLanes).map((laneId) =>
      selected.filter((revision) => (versionLanes[revision] ?? 0) === laneId)
    );
    const sourceIndex = activeLaneIds(selected, versionLanes).indexOf(sourceLane);
    groups[sourceIndex] = groups[sourceIndex].filter((revision) => revision !== draggingRevision);
    let insertionIndex = requestedIndex;
    if (groups[sourceIndex].length === 0) {
      groups.splice(sourceIndex, 1);
      if (sourceIndex < insertionIndex) insertionIndex -= 1;
    }
    groups.splice(Math.max(0, Math.min(insertionIndex, groups.length)), 0, [draggingRevision]);
    const normalizedLanes = { ...versionLanes };
    groups.forEach((group, laneIndex) => group.forEach((revision) => { normalizedLanes[revision] = laneIndex; }));
    updateSelectedWithAnimation(groups.flat(), normalizedLanes);
    setDraggingRevision(null); setDropTarget(null);
  }

  function versionColor(revision: number) {
    return versionColors[revision] ?? VERSION_COLORS[0];
  }

  const selectedVersions = selected.map((revision) => ({
    summary: revisions.find((item) => item.revision === revision),
    content: contents[revision]
  })).filter((item): item is { summary: TranscriptionRevisionSummary; content: TranscriptionRevisionContent } => Boolean(item.summary && item.content));

  const changes = selectedVersions.slice(1).map((version, index) => ({
    from: selectedVersions[index],
    to: version,
    ranges: compareWords(selectedVersions[index].content.words, version.content.words)
  }));
  const laneIds = activeLaneIds(selected, versionLanes);
  const lanes = laneIds.map((lane) => selectedVersions.filter((version) => (versionLanes[version.content.revision] ?? 0) === lane));

  if (!call) return <div className="transcription-compare-page"><div className="empty-state">Звонок не найден.</div></div>;

  return <div className="transcription-compare-page">
    <header className="transcription-compare-header">
      <button type="button" className="ghost-button small" onClick={onBack}><ArrowLeft size={17} />К звонку</button>
      <div><span className="eyebrow">История расшифровки</span><h1>Сравнение версий</h1><p>{call.title}</p></div>
      <div className="compare-version-count"><GitCompareArrows size={18} /><strong>{selected.length}</strong><span>версии</span></div>
    </header>

    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="transcription-compare-loading">Загружаю версии…</div> : <>
      <section className="compare-selection-panel" aria-label="Выбранные версии">
        <div className="compare-selected-versions">
          {selected.map((revision) => <span ref={(element) => { if (element) chipRefs.current.set(revision, element); else chipRefs.current.delete(revision); }} className="compare-version-chip" style={{ "--version-color": versionColor(revision), viewTransitionName: `compare-chip-${revision}` } as CSSProperties} key={revision}>
            <i />Версия {revision}
            {selected.length > 2 && <button type="button" aria-label={`Убрать версию ${revision}`} onClick={() => updateSelectedWithAnimation(selected.filter((item) => item !== revision))}><X size={14} /></button>}
          </span>)}
        </div>
        <div className="compare-add-version" ref={addVersionRef}>
          <button type="button" className="ghost-button small" aria-expanded={adding} onClick={() => setAdding((current) => !current)}><Plus size={16} />Добавить версию<ChevronDown size={15} /></button>
          {adding && <div className="compare-version-menu">
            {revisions.map((revision) => {
              const isSelected = selected.includes(revision.revision);
              const cannotRemove = isSelected && selected.length <= 2;
              return <button type="button" key={revision.id} className={isSelected ? "selected" : ""} aria-pressed={isSelected} disabled={(!isSelected && selected.length >= MAX_COMPARED_VERSIONS) || cannotRemove} title={cannotRemove ? "Для сравнения нужны минимум две версии" : undefined} onClick={() => void toggleVersion(revision.revision)}>
              <span><strong>Версия {revision.revision}</strong><small>{formatDate(revision.created_at)}</small></span>
              {isSelected && (cannotRemove ? <Check size={16} /> : <X size={16} />)}
            </button>;})}
          </div>}
        </div>
      </section>

      <section className="compare-version-board" style={{ "--compare-column-count": lanes.length } as CSSProperties}>
        {lanes.map((versions, laneIndex) => <div className={`compare-version-lane${dropTarget?.lane === laneIndex ? " is-drop-target" : ""}${dropTarget?.lane === laneIndex && dropTarget.columnPlacement ? ` is-column-${dropTarget.columnPlacement}` : ""}`} key={laneIndex} onDragOver={(event) => updateDropTarget(event, laneIndex as CompareLane)} onDrop={(event) => dropVersion(event, laneIndex as CompareLane)}>
          {draggingRevision !== null && lanes.length < selected.length && <div
            className={`compare-column-drop-zone is-before${dropTarget?.newColumnIndex === laneIndex ? " is-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
              setDropTarget({ lane: -1, index: 0, newColumnIndex: laneIndex });
            }}
            onDrop={(event) => dropAsNewColumn(event, laneIndex)}
          />}
          {draggingRevision !== null && lanes.length < selected.length && laneIndex === lanes.length - 1 && <div
            className={`compare-column-drop-zone is-after${dropTarget?.newColumnIndex === lanes.length ? " is-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
              setDropTarget({ lane: -1, index: 0, newColumnIndex: lanes.length });
            }}
            onDrop={(event) => dropAsNewColumn(event, lanes.length)}
          />}
          {versions.map((version, lanePosition) => {
            const globalIndex = selectedVersions.findIndex((item) => item.content.revision === version.content.revision);
            const referenceWords = globalIndex > 0
              ? selectedVersions[globalIndex - 1].content.words
              : selectedVersions[globalIndex + 1]?.content.words ?? [];
            return <Fragment key={version.content.revision}>
              {dropTarget?.lane === laneIndex && !dropTarget.columnPlacement && dropTarget.index === lanePosition && <div className="compare-drop-marker" />}
              <article data-revision={version.content.revision} ref={(element) => { if (element) cardRefs.current.set(version.content.revision, element); else cardRefs.current.delete(version.content.revision); }} className={`compare-version-card${draggingRevision === version.content.revision ? " is-dragging" : ""}`} style={{ "--version-color": versionColor(version.content.revision), viewTransitionName: `compare-card-${version.content.revision}` } as CSSProperties}>
                <header draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(version.content.revision)); setDraggingRevision(version.content.revision); }} onDragEnd={() => { setDraggingRevision(null); setDropTarget(null); }}><div><span className="version-dot" /><strong>Версия {version.content.revision}</strong>{version.summary.is_current && <em>Текущая</em>}</div><time>{formatDate(version.summary.created_at)}</time></header>
                <VersionTranscript words={version.content.words} referenceWords={referenceWords} speakerAssignments={speakerAssignments} />
              </article>
            </Fragment>;
          })}
          {dropTarget?.lane === laneIndex && !dropTarget.columnPlacement && dropTarget.index === versions.length && <div className="compare-drop-marker" />}
          {versions.length === 0 && <div className="compare-empty-lane">Перетащите версию сюда</div>}
        </div>)}
      </section>

      <section className="compare-change-log">
        <div className="compare-section-heading"><div><span className="eyebrow">Хронология</span><h2>Что и где изменилось</h2></div><small>Каждая версия сравнивается с предыдущей выбранной</small></div>
        {changes.length === 0 ? <div className="empty-state compact">Добавьте ещё одну версию для сравнения.</div> : changes.map((change) => <article className="compare-change-step" style={{ "--version-color": versionColor(change.to.content.revision) } as CSSProperties} key={change.to.content.revision}>
          <header><span className="version-dot" /><div><strong>Версия {change.from.content.revision} → {change.to.content.revision}</strong><time>{formatDate(change.to.summary.created_at)}</time></div><b>{change.ranges.length} {change.ranges.length === 1 ? "изменение" : "изменений"}</b></header>
          {change.ranges.length === 0 ? <p className="compare-no-changes">Текст и говорящие совпадают.</p> : <div className="compare-change-ranges">
            {change.ranges.map((range) => <div className={`compare-change-range is-${range.kind}`} key={`${range.startIndex}-${range.endIndex}`}>
              <div className="change-location"><strong>{changeKindLabel(range)}</strong><span>{formatRange(range.startSeconds, range.endSeconds)}</span></div>
              {(range.speakerBefore || range.speakerAfter) && range.speakerBefore !== range.speakerAfter && <div className="change-speaker">Говорящий: <del>{transcriptionSpeakerLabel(range.speakerBefore, speakerAssignments)}</del><span>→</span><ins>{transcriptionSpeakerLabel(range.speakerAfter, speakerAssignments)}</ins></div>}
              {range.kind !== "speaker" && <div className="change-text"><del>{range.before || "—"}</del><ins>{range.after || "—"}</ins></div>}
            </div>)}
          </div>}
        </article>)}
      </section>
    </>}
  </div>;
}

function VersionTranscript({ words, referenceWords, speakerAssignments }: { words: TranscriptionWordResponse[]; referenceWords: TranscriptionWordResponse[]; speakerAssignments: TranscriptionSpeakerAssignment[] }) {
  const diarized = words.some((word) => Boolean(word.speaker?.trim()));
  const groups = groupBySpeaker(words);
  const renderWord = (word: TranscriptionWordResponse, index: number) => {
    const reference = referenceWords[index];
    const changed = Boolean(reference) && (reference.text !== word.text || (reference.speaker ?? "") !== (word.speaker ?? ""));
    return <span className={changed ? "compare-word changed" : "compare-word"} title={changed ? "Изменено относительно соседней выбранной версии" : undefined} key={`${word.start_seconds}-${index}`}>{word.text}{" "}</span>;
  };
  if (!diarized) return <div className="compare-transcript-plain">{words.map(renderWord)}</div>;
  return <div className="compare-speaker-groups">{groups.map((group) => <section className="compare-speaker-group" key={`${group.speaker}-${group.startIndex}`}><header><strong>{transcriptionSpeakerLabel(group.speaker, speakerAssignments)}</strong><time>{formatRange(group.words[0]?.start_seconds, group.words.at(-1)?.end_seconds)}</time></header><p>{group.words.map((word, offset) => renderWord(word, group.startIndex + offset))}</p></section>)}</div>;
}

function groupBySpeaker(words: TranscriptionWordResponse[]) {
  const groups: Array<{ speaker: string; startIndex: number; words: TranscriptionWordResponse[] }> = [];
  words.forEach((word, index) => {
    const speaker = word.speaker?.trim() ?? "";
    const current = groups.at(-1);
    if (!current || current.speaker !== speaker) groups.push({ speaker, startIndex: index, words: [word] });
    else current.words.push(word);
  });
  return groups;
}

function compareWords(before: TranscriptionWordResponse[], after: TranscriptionWordResponse[]): WordChange[] {
  const changed: number[] = [];
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    const left = before[index]; const right = after[index];
    if (!left || !right || left.text !== right.text || (left.speaker ?? "") !== (right.speaker ?? "")) changed.push(index);
  }
  const ranges: WordChange[] = [];
  for (const index of changed) {
    const kind = wordChangeKind(before[index], after[index]);
    const last = ranges.at(-1);
    if (last && last.kind === kind && index === last.endIndex + 1) {
      last.endIndex = index;
      last.endSeconds = after[index]?.end_seconds ?? before[index]?.end_seconds;
      last.before = before.slice(last.startIndex, index + 1).map((word) => word.text).join(" ");
      last.after = after.slice(last.startIndex, index + 1).map((word) => word.text).join(" ");
      if (last.speakerBefore !== (before[index]?.speaker ?? "")) last.speakerBefore = "";
      if (last.speakerAfter !== (after[index]?.speaker ?? "")) last.speakerAfter = "";
      continue;
    }
    ranges.push({ kind, startIndex: index, endIndex: index, startSeconds: after[index]?.start_seconds ?? before[index]?.start_seconds, endSeconds: after[index]?.end_seconds ?? before[index]?.end_seconds, before: before[index]?.text ?? "", after: after[index]?.text ?? "", speakerBefore: before[index]?.speaker ?? "", speakerAfter: after[index]?.speaker ?? "" });
  }
  return ranges;
}

function wordChangeKind(before?: TranscriptionWordResponse, after?: TranscriptionWordResponse): WordChange["kind"] {
  if (!before) return "add";
  if (!after) return "remove";
  const textChanged = before.text !== after.text;
  const speakerChanged = (before.speaker ?? "") !== (after.speaker ?? "");
  if (speakerChanged && textChanged) return "speaker-and-replace";
  if (speakerChanged) return "speaker";
  return "replace";
}

function changeKindLabel(change: WordChange) {
  switch (change.kind) {
    case "speaker": return "Смена говорящего";
    case "add": return "Добавление слов";
    case "remove": return "Удаление слов";
    case "speaker-and-replace": return "Замена слов и смена говорящего";
    default: return "Замена слов";
  }
}

function formatRange(start?: number, end?: number) {
  const stamp = (seconds?: number) => seconds === undefined ? "" : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const left = stamp(start); const right = stamp(end);
  return left && right ? `${left}–${right}` : left || right || "Без таймкода";
}

function defaultLane(index: number, total: number): CompareLane {
  return index < Math.ceil(total / 2) ? 0 : 1;
}

function activeLaneIds(selected: number[], lanes: Record<number, CompareLane>) {
  const populated = Array.from(new Set(selected.map((revision) => lanes[revision] ?? 0))).sort((a, b) => a - b);
  return populated.length >= 2 ? populated : [0, 1];
}

function countLane(selected: number[], lanes: Record<number, CompareLane>, lane: CompareLane) {
  return selected.filter((revision) => (lanes[revision] ?? 0) === lane).length;
}
