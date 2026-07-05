import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  ChangeEvent,
  DragEvent,
  ReactNode,
  SelectHTMLAttributes
} from "react";

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

type SelectControlOption = {
  disabled: boolean;
  key: string;
  label: string;
  value: string;
};

type SelectControlProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "size"> & {
  children: ReactNode;
};

export function SelectControl({
  children,
  className,
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  value,
  ...props
}: SelectControlProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ""));
  const rootRef = useRef<HTMLSpanElement>(null);
  const options = useMemo(() => collectSelectOptions(children), [children]);
  const currentValue = value !== undefined ? String(value) : internalValue || options[0]?.value || "";
  const selectedOption = options.find((option) => option.value === currentValue) ?? options[0];
  const ariaLabel = props["aria-label"] ?? props.title ?? selectedOption?.label ?? "Выберите значение";

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function selectValue(nextValue: string) {
    if (disabled) return;

    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.({
      currentTarget: { name, value: nextValue },
      target: { name, value: nextValue }
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  return (
    <span
      className={`select-control custom-select ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className ?? ""}`}
      ref={rootRef}
    >
      <button
        className="select-trigger"
        type="button"
        id={controlId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selectedOption?.label ?? "Не выбрано"}</span>
      </button>
      {name && <input type="hidden" name={name} value={currentValue} />}
      {open && (
        <span className="select-menu" role="listbox" aria-labelledby={controlId}>
          {options.map((option) => (
            <button
              className={option.value === currentValue ? "active" : ""}
              disabled={option.disabled}
              key={option.key}
              role="option"
              type="button"
              aria-selected={option.value === currentValue}
              onClick={() => selectValue(option.value)}
            >
              {option.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function collectSelectOptions(children: ReactNode): SelectControlOption[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement(child)) return [];

    const optionProps = child.props as {
      children?: ReactNode;
      disabled?: boolean;
      label?: string;
      value?: number | string;
    };
    const label = optionProps.label ?? textFromReactNode(optionProps.children);
    const optionValue = optionProps.value ?? label;

    return [{
      disabled: Boolean(optionProps.disabled),
      key: child.key?.toString() ?? `${optionValue}-${index}`,
      label,
      value: String(optionValue)
    }];
  });
}

function textFromReactNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromReactNode).join("");
  return "";
}

export function NativeSelectControl(props: SelectHTMLAttributes<HTMLSelectElement>) {
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
