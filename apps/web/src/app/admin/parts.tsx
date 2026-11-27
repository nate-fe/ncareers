/**
 * 어드민 화면들이 같이 쓰는 조각. 라우트가 아니다 (page.tsx 가 아니므로).
 *
 * 폼과 결과 메시지는 클라이언트 쪽이 필요해서 forms.tsx 에 따로 있다.
 * 여기 있는 건 전부 서버에서 그려지는 껍데기다.
 */

export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 border border-line bg-card">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {note && <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  required,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const cls =
    "mt-1.5 w-full border border-line-2 bg-paper px-3 py-2.5 text-[15.5px] outline-none focus:border-brand";
  return (
    <label className="block">
      <span className="text-[14.5px] font-bold">
        {label}
        {required && <span className="text-point"> *</span>}
      </span>
      {textarea ? (
        <textarea
          name={name}
          rows={3}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cls}
        />
      ) : (
        <input
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {hint && <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export const SERVICES = [
  "nate-news",
  "nate-pann",
  "nate-on",
  "nate-mail",
  "nate-search",
  "cyworld",
  "nate-q",
  "cross-service",
] as const;

export function ServicePicker({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-[14.5px] font-bold">
        서비스<span className="text-point"> *</span>
      </span>
      <select
        name="service"
        defaultValue={defaultValue ?? "cross-service"}
        className="mt-1.5 w-full border border-line-2 bg-paper px-3 py-2.5 text-[15.5px] outline-none focus:border-brand"
      >
        {SERVICES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-12 text-center text-[15px] text-muted">{children}</p>;
}
