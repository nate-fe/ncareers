"use client";

import { createContext, useActionState, useContext, useId } from "react";
import { messageOf, type ActionState } from "./errors";
import { loginAction } from "./actions";

/**
 * 어드민 폼.
 *
 * 서버 액션이 돌려준 코드를 폼 안에서 바로 보여 줍니다. 주소창을 거치지 않으므로
 * 새로고침하면 메시지가 사라지고, 링크를 복사해 보내도 남의 화면에 뜨지 않습니다.
 *
 * useActionState 는 자바스크립트가 꺼져 있어도 폼 제출 자체는 동작합니다
 * (서버 액션의 점진적 향상). 그때는 메시지만 안 보일 뿐 처리는 됩니다.
 */

type Ctx = { state: ActionState; pending: boolean; messageId: string };

const FormCtx = createContext<Ctx>({ state: null, pending: false, messageId: "" });

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  className,
  children,
}: {
  action: Action;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const messageId = useId();

  return (
    <FormCtx.Provider value={{ state, pending, messageId }}>
      <form action={formAction} className={className}>
        {children}
      </form>
    </FormCtx.Provider>
  );
}

/**
 * 결과 문구. **제출 버튼 바로 위에** 놓습니다.
 * 오류는 빨강(포인트 컬러), 성공은 브랜드 그린.
 */
export function FormMessage({ className = "" }: { className?: string }) {
  const { state, messageId } = useContext(FormCtx);
  if (!state) return null;

  const isError = state.status === "error";
  return (
    <p
      id={messageId}
      role={isError ? "alert" : "status"}
      className={`text-[14px] leading-relaxed ${
        isError ? "font-bold text-point-ink" : "text-brand-ink"
      } ${className}`}
    >
      {isError && (
        <span aria-hidden className="mr-1">
          !
        </span>
      )}
      {messageOf(state.code)}
    </p>
  );
}

export function SubmitButton({
  children,
  tone = "plain",
  full = false,
}: {
  children: React.ReactNode;
  tone?: "plain" | "brand" | "danger";
  full?: boolean;
}) {
  const { pending } = useContext(FormCtx);
  const look =
    tone === "brand"
      ? "bg-brand text-on-brand hover:opacity-85"
      : tone === "danger"
        ? "border border-point text-point-ink hover:bg-point/10"
        : "border border-line-2 hover:border-brand hover:text-brand-ink";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-4 py-2 text-[14.5px] font-bold transition-colors disabled:opacity-50 ${look} ${
        full ? "w-full py-3 text-[16px]" : ""
      }`}
    >
      {pending ? "처리 중…" : children}
    </button>
  );
}

/** 로그인. 오류는 '들어가기' 버튼 바로 위에 빨간 헬프텍스트로 붙습니다. */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const errorId = useId();
  const failed = state?.status === "error";

  return (
    <form action={formAction} className="border border-line bg-card p-6">
      <label htmlFor="admin-password" className="block text-[15px] font-bold">
        운영자 비밀번호
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={failed}
        aria-describedby={failed ? errorId : undefined}
        className={`mt-2 w-full border bg-paper px-3 py-2.5 text-[16px] outline-none ${
          failed ? "border-point focus:border-point" : "border-line-2 focus:border-brand"
        }`}
      />

      {failed && (
        <p id={errorId} role="alert" className="mt-2 text-[14px] font-bold leading-relaxed text-point-ink">
          <span aria-hidden className="mr-1">
            !
          </span>
          {messageOf(state.code)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full bg-brand px-4 py-3 text-[16px] font-bold text-on-brand transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}
