type InfoPage = {
  title: string;
  description: string;
  sections: { title: string; text: string; link?: [string, string] }[];
};

export type InfoSlug = "privacy" | "terms" | "help";

export const information: Record<"ru" | "en", Record<InfoSlug, InfoPage>> = {
  ru: {
    privacy: {
      title: "Конфиденциальность",
      description: "Какие данные нужны SONA для просмотра сериалов и как управлять ими в профиле и браузере.",
      sections: [
        { title: "Аккаунт и устройства", text: "Для гостевого просмотра SONA присваивает браузеру идентификатор. При регистрации вы вводите email и пароль и подтверждаете адрес кодом из письма. Язык контента и часовой пояс сохраняются в профиле. Активные устройства можно посмотреть отдельно.", link: ["/devices", "Открыть устройства"] },
        { title: "История просмотра", text: "SONA сохраняет выбранную серию и позицию воспроизведения, чтобы вы могли продолжить просмотр. В коллекции сохраняются ваши закладки и отметки «Нравится». Лента также отправляет события показа, начала и завершения просмотра, времени просмотра и переключения между видео.", link: ["/history", "Посмотреть историю"] },
        { title: "Что хранится в браузере", text: "Два служебных cookie поддерживают сеанс и его продление. Их срок действия задаёт сервер. Выбранный язык интерфейса хранится в cookie до года. Настроение главной страницы и закрепления в разделе «Продолжить просмотр» сохраняются на этом устройстве. Очистка данных сайта сбрасывает местные настройки и завершает сеанс в этом браузере." },
        { title: "Платежи и внешние сервисы", text: "При покупке монет сведения о платеже вы вводите на странице Stripe Checkout. В кошельке SONA отображаются баланс и операции. Для проверки регистрации сайт может использовать Cloudflare Turnstile. Если вы разрешили push-уведомления, SONA использует Firebase Cloud Messaging и токен браузера для доставки сообщений. Разрешение можно отозвать в настройках браузера.", link: ["/wallet", "Открыть кошелёк"] },
        { title: "Управление данными", text: "В настройках можно изменить язык контента и часовой пояс или запросить удаление аккаунта. После подтверждения запроса все устройства выйдут из аккаунта. Если вы снова войдёте до назначенной даты удаления, запрос будет отменён.", link: ["/settings", "Открыть настройки"] },
      ],
    },
    terms: {
      title: "Условия использования",
      description: "Как устроены доступ к сериям, монеты и покупки в веб-кинотеатре SONA.",
      sections: [
        { title: "Просмотр", text: "Каталог можно открыть без регистрации. На странице сериала выберите эпизод. Для отдельных эпизодов может потребоваться вход или разблокировка. Доступные для вашего аккаунта варианты показаны в плеере.", link: ["/catalog", "Перейти в каталог"] },
        { title: "Открытие серий", text: "Если для эпизода доступно бесплатное открытие, плеер покажет остаток на сегодня. При открытии за монеты сначала проверьте, что выбрано — одна серия или весь сериал. Кнопка показывает, сколько монет будет списано из кошелька." },
        { title: "Покупка монет", text: "В магазине выберите пакет и проверьте цену и валюту на платёжной странице Stripe перед подтверждением. Кошелёк пополнится после подтверждения платежа. Начисления и списания можно проверить в истории операций.", link: ["/wallet", "Проверить баланс и операции"] },
        { title: "Ваш аккаунт", text: "Храните пароль и коды входа в секрете. Если входили с общего устройства, выйдите из профиля после просмотра. Вопросы о настройках, доступе и оплате собраны в разделе помощи.", link: ["/help", "Помощь зрителю"] },
      ],
    },
    help: {
      title: "Помощь",
      description: "Ответы на вопросы о просмотре, закрытых сериях и покупках в SONA.",
      sections: [
        { title: "Как переключать серии?", text: "На телефоне смахните видео вверх, чтобы перейти к следующей серии, или вниз, чтобы вернуться. Кнопка «Серии» открывает список эпизодов. На компьютере выберите нужную серию в списке рядом с плеером." },
        { title: "Где продолжить просмотр?", text: "Откройте историю и выберите сериал. Карточка покажет номер серии и сохранённую позицию.", link: ["/history", "Открыть историю"] },
        { title: "Почему серия закрыта?", text: "Откройте эпизод и посмотрите варианты доступа. Плеер подскажет, достаточно ли войти в аккаунт и доступно ли открытие бесплатно или за монеты." },
        { title: "Оплата прошла, где монеты?", text: "Вернитесь из Stripe в тот аккаунт SONA, в котором начали покупку, и откройте историю операций. Если подтверждение платежа уже пришло, а монет пока нет, сохраните номер операции из квитанции.", link: ["/wallet", "Открыть кошелёк"] },
        { title: "Как отключить уведомления?", text: "В профиле откройте «Уведомления» и измените настройки. Получение всех уведомлений от sona-ai.watch можно также отключить в настройках сайта в браузере.", link: ["/profile", "Открыть профиль"] },
      ],
    },
  },
  en: {
    privacy: {
      title: "Privacy notice",
      description: "Learn what data SONA uses for streaming and how to manage it in your account and browser.",
      sections: [
        { title: "Account and devices", text: "SONA assigns your browser an identifier when you watch as a guest. When you register, you enter an email address and password and verify the address with a code sent by email. Your profile stores your preferred content language and time zone. You can also review your active devices.", link: ["/devices", "View devices"] },
        { title: "Viewing history", text: "SONA saves your episode and playback position so you can pick up where you left off. Your collection stores your bookmarks and likes. The feed also sends events when a video appears, when playback starts or ends, how long you watch, and when you swipe between videos.", link: ["/history", "View watch history"] },
        { title: "Data in your browser", text: "Two service cookies maintain and renew your session. The server sets their expiry times. A language cookie remembers your interface language for up to one year. Your home page mood and pinned shows in Continue watching are stored on this device. Clearing site data resets local preferences and signs you out of this browser." },
        { title: "Payments and service providers", text: "When you buy coins, you enter your payment details on Stripe Checkout. Your SONA wallet shows your balance and transactions. The site may use Cloudflare Turnstile during registration. If you allow push notifications, SONA uses Firebase Cloud Messaging and a browser token to deliver them. You can revoke permission in your browser settings.", link: ["/wallet", "Open wallet"] },
        { title: "Managing your data", text: "In settings you can change your content language or time zone and request account deletion. Confirming deletion signs you out on all devices. Signing in again before the scheduled deletion date cancels your request.", link: ["/settings", "Open settings"] },
      ],
    },
    terms: {
      title: "Terms of use",
      description: "How episode access, coins and purchases work on SONA.",
      sections: [
        { title: "Watching series", text: "You can browse the catalog as a guest. Choose an episode on the series page. Some episodes require sign-in or an unlock. The player shows the options available to your account.", link: ["/catalog", "Browse the catalog"] },
        { title: "Unlocking episodes", text: "If a free unlock is available, the player shows how many you have left today. Before spending coins, check whether you are unlocking one episode or the entire series. The button shows how many coins will be deducted from your wallet." },
        { title: "Buying coins", text: "Choose a pack in the shop and check the price and currency on Stripe’s payment page before confirming. Coins are added after payment confirmation. You can review credits and spending in your wallet.", link: ["/wallet", "View balance and transactions"] },
        { title: "Your account", text: "Keep your password and sign-in codes private. If you use a shared device, sign out when you finish watching. Visit Help for questions about preferences, episode access and payments.", link: ["/help", "Get help"] },
      ],
    },
    help: {
      title: "Help",
      description: "Answers to common questions about watching series, unlocking episodes and buying coins on SONA.",
      sections: [
        { title: "How do I switch episodes?", text: "On a phone, swipe up on the video for the next episode or down for the previous one. Tap Episodes to open the list. On a computer, choose an episode from the list beside the player." },
        { title: "How do I resume a series?", text: "Open your watch history and choose a series. Its card shows the episode number and your saved playback position.", link: ["/history", "Open watch history"] },
        { title: "Why is an episode locked?", text: "Open the episode to see its access options. The player shows whether you need to sign in and whether a free or coin unlock is available." },
        { title: "I paid. Where are my coins?", text: "Return from Stripe to the SONA account you used for the purchase and open your transaction history. If you have payment confirmation and the coins have yet to appear, keep the transaction reference from your receipt.", link: ["/wallet", "Open wallet"] },
        { title: "How do I turn off notifications?", text: "Open Notifications in your profile to change your preferences. You can also turn off all notifications from sona-ai.watch in your browser’s site settings.", link: ["/profile", "Open profile"] },
      ],
    },
  },
};
