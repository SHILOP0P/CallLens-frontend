import { DragEvent,useState } from "react";

export function Logo({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <span className="logo-mark">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>CallLens</span>
    </>
  );

  if (onClick) {
    return (
      <button className="logo logo-button" type="button" onClick={onClick} aria-label="CallLens">
        {content}
      </button>
    );
  }

  return (
    <div className="logo" aria-label="CallLens">
      {content}
    </div>
  );
}

export function SelectControl(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-control">
      <select {...props} />
    </span>
  );
}

export function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function FileDropZone({
  file,
  icon,
  accept,
  buttonLabel,
  emptyLabel,
  onFile
}: {
  file: File | null;
  icon: React.ReactNode;
  accept: string;
  buttonLabel: string;
  emptyLabel: string;
  onFile: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      onFile(droppedFile);
    }
  }

  return (
    <label
      className={`file-dropzone ${dragActive ? "dragging" : ""}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <span className="file-dropzone-icon">{icon}</span>
      <span className="file-dropzone-copy">
        <strong>{file?.name ?? emptyLabel}</strong>
        <small>{file ? "Файл готов к загрузке" : "Можно выбрать через проводник или перетащить файл"}</small>
      </span>
      <span className="ghost-button file-dropzone-button">{buttonLabel}</span>
    </label>
  );
}
