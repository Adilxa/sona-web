"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { authenticate, useSession } from "@/entities/session";
import { installation, SonaError } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { InteriorPage } from "@/shared/ui/interior-page";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { BotCheck } from "./providers";
import styles from "./login.module.css";

type Schema = components["schemas"];

export function LoginPage({ destination, linkEmail = false }: { destination: string; linkEmail?: boolean }) {
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendWait, setResendWait] = useState(0);
  const [submitWait, setSubmitWait] = useState(0);
  const [challenge, setChallenge] = useState(0);
  const [attestation, setAttestation] = useState("");
  useEffect(() => {
    if (me?.role === "user" && !linkEmail) router.replace(destination);
  }, [me?.role, linkEmail, destination, router]);
  useEffect(() => { if (sent) field.current?.focus(); }, [sent]);
  useEffect(() => {
    if (!resendWait && !submitWait) return;
    const timer = setTimeout(() => {
      setResendWait(n => Math.max(0, n - 1));
      setSubmitWait(n => Math.max(0, n - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendWait, submitWait]);

  function resetStep() {
    setSent(false); setCode(""); setError(""); setNotice(""); setResendWait(0); setSubmitWait(0);
    setChallenge(0); setAttestation(""); setReveal(false);
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
      setError(register ? "Пароль должен содержать от 15 до 128 символов." : "Пароль может содержать до 128 символов."); return;
    }
    submitting.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (requesting) {
        await authenticate("email/request", {
          email: address, password, attestation: attestation ? { kind: "turnstile", token: attestation } : undefined,
        } satisfies Schema["EmailCodeRequest"]);
        setSent(true); setCode(""); setResendWait(60); setChallenge(0); setAttestation("");
        if (resend) { setNotice("Запрошен новый код."); field.current?.focus(); }
        return;
      }
      const device = installation();
      if (register) await authenticate(linkEmail ? "email/link" : "email/verify", { email: address, password, code, device } satisfies Schema["EmailCodeVerify"]);
      else await authenticate("email/login", { email: address, password, device } satisfies Schema["PasswordLogin"]);
      setPassword(""); setCode(""); router.replace(destination);
    } catch (reason) {
      if (reason instanceof SonaError) {
        if (requesting && reason.code === "attestation_required") { setAttestation(""); setChallenge(n => n + 1); setError("Пройдите проверку и запросите код ещё раз."); }
        else if (reason.code === "invalid_credentials") setError(register ? "Не удалось подтвердить регистрацию. Проверьте код и данные или войдите с паролем." : "Проверьте электронную почту и пароль.");
        else setError(reason.message);
        if (reason.retryAfter > 0) (requesting ? setResendWait : setSubmitWait)(reason.retryAfter);
      } else setError("Не удалось связаться с SONA. Попробуйте ещё раз.");
    } finally { submitting.current = false; setBusy(false); }
  }
  const waiting = sent || !register ? submitWait : resendWait;
  const sendDisabled = busy || !!resendWait || (!!challenge && !attestation);
  const title = sent ? "Введите код" : linkEmail ? "Привязать почту" : register ? "Регистрация" : "Вход в SONA";
  const backLabel = destination.startsWith("/series/") ? "К сериалу" : destination === "/profile" ? "Профиль" : "Назад";
  return <InteriorPage title={title} back={{ href: destination, label: backLabel }}>
    <div className={styles.scene}>
    <div className={styles.poster} aria-hidden="true" />
    <div className={styles.panel}><Fade className={styles.formWrap} initialOpacity={0.85}>
      {sessionError ? <><p role="alert">{sessionError}</p><Button onClick={reload}>Повторить</Button></>
      : !me || (me.role === "user" && !linkEmail) ? <SonaLoader label="Проверяем сеанс" />
      : linkEmail && me.role !== "user" ? <><p className={styles.intro}>Откройте эту страницу на устройстве с действующим сеансом вашего аккаунта.</p><Link href="/login">Перейти ко входу</Link></>
      : <>
        <p className={styles.intro}>{sent ? `Шесть цифр из письма на ${email.trim()}.` : linkEmail ? "Добавьте почту и пароль для входа в этот аккаунт." : register ? "Укажите почту и придумайте пароль. Мы отправим код подтверждения." : "Войдите, чтобы продолжить просмотр и открыть свою коллекцию."}</p>
        {!sent && !linkEmail && <div className={styles.methods} role="group" aria-label="Аккаунт">
          {[false, true].map(option => <Button key={String(option)} type="button" aria-pressed={register === option} disabled={busy}
            onClick={() => { if (register !== option) { resetStep(); setPassword(""); setRegister(option); } }}>{option ? "Регистрация" : "Вход"}</Button>)}
        </div>}
        <form onSubmit={submit}>
          {sent ? <label>Код из письма<input ref={field} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
            className={styles.code} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,""))} readOnly={busy} /></label>
          : <>
            <label>Электронная почта<input name="email" type="email" autoComplete="username" placeholder="name@example.com" autoCapitalize="none" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} readOnly={busy} /></label>
            <label>Пароль<span className={styles.password}><input name="password" type={reveal ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"}
              aria-describedby={register ? "password-length" : undefined} minLength={register ? 15 : 1} required value={password} onChange={e => setPassword(e.target.value)} readOnly={busy} />
              <Button type="button" aria-label={reveal ? "Скрыть пароль" : "Показать пароль"} onClick={() => setReveal(v => !v)}>{reveal ? <EyeOff size={17} /> : <Eye size={17} />}</Button></span>
              {register && <small id="password-length">От 15 до 128 символов</small>}
            </label>
          </>}
          {challenge > 0 && <BotCheck key={challenge} onToken={setAttestation} />}
          {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
          <Button className={styles.submit} type="submit" disabled={busy || !!waiting || (register && !sent && !!challenge && !attestation)}>
            {busy ? <SonaLoader label="Подождите…" /> : waiting ? `Повторить через ${waiting} с` : sent ? "Подтвердить почту" : register ? "Получить код" : "Войти"}<ArrowRight size={18} aria-hidden="true" />
          </Button>
        </form>
        {sent && <div className={styles.secondary}>
          <Button type="button" disabled={busy} onClick={resetStep}><ArrowLeft size={15} /> Изменить данные</Button>
          <Button type="button" disabled={sendDisabled} onClick={() => submit(undefined,true)}>{resendWait ? `Повтор через ${resendWait} с` : "Отправить ещё раз"}</Button>
        </div>}
      </>}
    </Fade></div>
    </div>
  </InteriorPage>;
}
