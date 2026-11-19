"use client";

import { useI18n } from "@/shared/i18n/context";
import { localizedPath } from "@/shared/seo/urls";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { authenticate, useSession } from "@/entities/session";
import { installation, SonaError } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { InteriorPage } from "@/shared/ui/interior-page";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { BotCheck } from "./providers";
import styles from "./login.module.css";

type Schema = components["schemas"];

export function LoginPage({ destination, linkEmail = false }: { destination: string; linkEmail?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { me, error: sessionError, reload } = useSession();
  const [register, setRegister] = useState(linkEmail);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const addressField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  const [codeRejected, setCodeRejected] = useState(false);
  const descriptionId = useId();
  const errorId = useId();
  const [error, setError] = useState<Error | [string, string] | null>(null);
  const [notice, setNotice] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [submitWait, setSubmitWait] = useState(0);
  const [challenge, setChallenge] = useState(0);
  const [attestation, setAttestation] = useState("");
  useEffect(() => {
    if (me?.role === "user" && !linkEmail) router.replace(destination);
  }, [me?.role, linkEmail, destination, router]);
  useEffect(() => {
    if (sent) field.current?.focus();
    else if (linkEmail && me?.role === "user") addressField.current?.focus({ preventScroll: true });
  }, [sent, linkEmail, me?.role]);
  useEffect(() => {
    if (!resendWait && !submitWait) return;
    const timer = setTimeout(() => {
      setResendWait(n => Math.max(0, n - 1));
      setSubmitWait(n => Math.max(0, n - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendWait, submitWait]);

  function resetStep() {
    setSent(false); setCode(""); setError(null); setNotice(false); setResendWait(0); setSubmitWait(0);
    setChallenge(0); setAttestation(""); setReveal(false); setCodeRejected(false);
  }

  async function submit(event?: FormEvent, resend = false) {
    event?.preventDefault();
    if (submitting.current) return;
    const requesting = register && (!sent || resend);
    if (requesting && (resendWait || (challenge > 0 && !attestation))) return;
    if (!requesting && submitWait) return;
    const address = email.trim();
    const length = Array.from(password).length;
    if (length > 128 || (register && length < 15)) {
      setError(register ? ["Пароль должен содержать от 15 до 128 символов.", "Use a password between 15 and 128 characters."] : ["Пароль может содержать до 128 символов.", "Your password can contain up to 128 characters."]);
      if (linkEmail) passwordField.current?.focus();
      return;
    }
    submitting.current = true; setBusy(true); setError(null); setNotice(false); setCodeRejected(false);
    try {
      if (requesting) {
        await authenticate("email/request", {
          email: address, password, attestation: attestation ? { kind: "turnstile", token: attestation } : undefined,
        } satisfies Schema["EmailCodeRequest"]);
        setSent(true); setCode(""); setCodeRejected(false); setResendWait(60); setChallenge(0); setAttestation("");
        if (resend) { setNotice(true); field.current?.focus(); }
        return;
      }
      const device = installation();
      if (register) await authenticate(linkEmail ? "email/link" : "email/verify", { email: address, password, code, device } satisfies Schema["EmailCodeVerify"]);
      else await authenticate("email/login", { email: address, password, device } satisfies Schema["PasswordLogin"]);
      setPassword(""); setCode(""); router.replace(destination);
    } catch (reason) {
      if (reason instanceof SonaError) {
        if (requesting && reason.code === "attestation_required") { setAttestation(""); setChallenge(n => n + 1); setError(["Пройдите проверку и запросите код ещё раз.", "Complete the verification and request a new code."]); }
        else if (linkEmail && sent && !requesting && reason.code === "invalid_credentials") {
          setCodeRejected(true);
          setError(["Не удалось подтвердить почту. Проверьте код из последнего письма.", "Couldn’t verify your email. Check the code in the most recent email."]);
          field.current?.focus();
          field.current?.select();
        } else if (reason.code === "invalid_credentials") setError(register ? ["Не удалось подтвердить регистрацию. Проверьте код и данные или войдите с паролем.", "Couldn’t complete registration. Check your code and details, or sign in with your password."] : ["Проверьте электронную почту и пароль.", "Check your email and password."]);
        else setError(reason);
        if (reason.retryAfter > 0) (requesting ? setResendWait : setSubmitWait)(reason.retryAfter);
      } else setError(["Не удалось связаться с SONA. Попробуйте ещё раз.", "Couldn’t connect to SONA. Try again."]);
    } finally { submitting.current = false; setBusy(false); }
  }
  const waiting = sent || !register ? submitWait : resendWait;
  const sendDisabled = busy || !!resendWait || (!!challenge && !attestation);
  const title = sent ? t("Введите код", "Enter the code") : linkEmail ? t("Привязать почту", "Link email") : register ? t("Регистрация", "Create account") : t("Вход в SONA", "Sign in to SONA");
  const backLabel = destination.startsWith("/series/") ? t("К сериалу", "Back to series") : destination === "/profile" ? t("Профиль", "Profile") : t("Назад", "Back");
  return <InteriorPage title={title} back={{ href: destination, label: backLabel }}>
    <div className={styles.scene} data-link-email={linkEmail || undefined}>
    <div className={styles.poster} aria-hidden="true" />
    <div className={styles.panel}><Fade className={styles.formWrap} initialOpacity={linkEmail ? 1 : 0.85}>
      {sessionError ? <><p role="alert">{sessionError}</p><Button onClick={reload}>{t("Повторить", "Try again")}</Button></>
      : !me || (me.role === "user" && !linkEmail) ? <SonaLoader label={t("Проверяем сеанс", "Checking your session")} />
      : linkEmail && me.role !== "user" ? <><p className={styles.intro}>{t("Откройте эту страницу на устройстве с действующим сеансом вашего аккаунта.", "Open this page on a device where you’re already signed in.")}</p><Link href="/login">{t("Перейти ко входу", "Go to sign in")}</Link></>
      : <>
        {linkEmail && <ol className={styles.steps} role="list" aria-label={t("Этапы привязки почты", "Email linking steps")}>
          <li aria-current={sent ? undefined : "step"} data-complete={sent || undefined}>
            <span aria-hidden="true">{sent ? <Check size={14} strokeWidth={3} /> : "1"}</span>{t("Почта и пароль", "Email and password")}
          </li>
          <li aria-current={sent ? "step" : undefined}><span aria-hidden="true">2</span>{t("Код из письма", "Email code")}</li>
        </ol>}
        <p className={styles.intro} id={descriptionId}>{sent
          ? linkEmail ? <>{t("Введите шесть цифр из письма на", "Enter the six digits sent to")} <bdi>{email.trim()}</bdi>.</> : t(`Шесть цифр из письма на ${email.trim()}.`, `Enter the six digits sent to ${email.trim()}.`)
          : linkEmail ? t("С этой почтой и паролем вы сможете войти в свой аккаунт SONA на другом устройстве.", "Use this email and password to sign in to your SONA account on another device.") : register ? t("Укажите почту и придумайте пароль. Мы отправим код подтверждения.", "Enter your email and create a password. We’ll send you a verification code.") : t("Войдите, чтобы продолжить просмотр и открыть свою коллекцию.", "Sign in to keep watching and access your collection.")}</p>
        {!sent && !linkEmail && <div className={styles.methods} role="group" aria-label={t("Аккаунт", "Account")}>
          {[false, true].map(option => <Button key={String(option)} type="button" aria-pressed={register === option} disabled={busy}
            onClick={() => { if (register !== option) { resetStep(); setPassword(""); setRegister(option); } }}>{option ? t("Регистрация", "Create account") : t("Вход", "Sign in")}</Button>)}
        </div>}
        <form key={linkEmail && sent ? "link-code" : "account"} onSubmit={submit} aria-busy={busy}>
          {sent ? <label>{t("Код из письма", "Email code")}<input ref={field} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
            className={styles.code} value={code} placeholder={linkEmail ? "••••••" : undefined}
            aria-invalid={codeRejected || undefined} aria-describedby={linkEmail ? [descriptionId, codeRejected && errorId].filter(Boolean).join(" ") : undefined}
            onChange={e => {
              setCode(e.target.value.replace(/\D/g,""));
              if (codeRejected) { setCodeRejected(false); setError(null); }
            }} readOnly={busy} /></label>
          : <>
            <label>{t("Электронная почта", "Email address")}<input ref={addressField} name="email" type="email" autoComplete="username" placeholder="name@example.com" autoCapitalize="none" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} readOnly={busy} /></label>
            <label>{t("Пароль", "Password")}<span className={styles.password}><input ref={passwordField} name="password" type={reveal ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"}
              aria-describedby={register ? "password-length" : undefined} minLength={register ? 15 : 1} required value={password} onChange={e => setPassword(e.target.value)} readOnly={busy} />
              <Button type="button" aria-label={reveal ? t("Скрыть пароль", "Hide password") : t("Показать пароль", "Show password")} onClick={() => setReveal(v => !v)}>{reveal ? <EyeOff size={17} /> : <Eye size={17} />}</Button></span>
              {register && <small id="password-length">{t("От 15 до 128 символов", "15 to 128 characters")}</small>}
            </label>
          </>}
          {challenge > 0 && <BotCheck key={challenge} onToken={setAttestation} />}
          {error && <p role="alert" id={errorId} className={styles.error}>{error instanceof Error ? error.message : t(...error)}</p>}{notice && <p role="status">{t("Запрошен новый код.", "A new code has been requested.")}</p>}
          <Button className={styles.submit} type="submit" disabled={busy || !!waiting || (register && !sent && !!challenge && !attestation)}>
            {busy ? <SonaLoader label={t("Подождите…", "Please wait…")} /> : waiting ? t(`Повторить через ${waiting} с`, `Try again in ${waiting}s`) : sent ? t("Подтвердить почту", "Verify email") : register ? t("Получить код", "Get code") : t("Войти", "Sign in")}<ArrowRight size={18} aria-hidden="true" />
          </Button>
        </form>
        {register && <p className={styles.policies}><Link href={localizedPath("/terms", locale)}>{t("Условия использования", "Terms of use")}</Link><Link href={localizedPath("/privacy", locale)}>{t("Конфиденциальность", "Privacy notice")}</Link></p>}
        {sent && <div className={styles.secondary}>
          <Button type="button" disabled={busy} onClick={resetStep}><ArrowLeft aria-hidden="true" size={15} /> {linkEmail ? t("Изменить почту", "Change email") : t("Изменить данные", "Edit details")}</Button>
          <Button type="button" disabled={sendDisabled} onClick={() => submit(undefined,true)}>{resendWait ? t(`Повтор через ${resendWait} с`, `Resend in ${resendWait}s`) : t("Отправить ещё раз", "Resend code")}</Button>
        </div>}
      </>}
    </Fade></div>
    </div>
  </InteriorPage>;
}
