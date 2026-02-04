import './LegalPage.css';

export const PrivacyPolicy = () => (
  <div className="legal-page">
    <section className="legal-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
      <h2>1. 収集する情報 / Information We Collect</h2>
      <ul>
        <li>セッションデータ（気分、時間） / Session data (mood, duration)</li>
        <li>生成された画像・音楽 / Generated images and music</li>
        <li>アクセスログ / Access logs</li>
        <li>パフォーマンス指標 / Performance metrics</li>
      </ul>
    </section>

    <section className="legal-section">
      <h2>2. データの使用目的 / Purpose of Data Use</h2>
      <p>
        収集したデータは以下の目的で使用されます：
      </p>
      <ul>
        <li>サービスの提供と改善 / Service provision and improvement</li>
        <li>パフォーマンスの監視 / Performance monitoring</li>
        <li>エラーのトラッキングと修正 / Error tracking and fixing</li>
      </ul>
    </section>

    <section className="legal-section">
      <h2>3. データの保存 / Data Storage</h2>
      <p>
        ユーザーデータは主にブラウザのローカルストレージに保存されます。
        サーバー側では一時的な処理のみが行われます。
      </p>
      <p>
        User data is primarily stored in browser's local storage. 
        Server-side processing is temporary only.
      </p>
      <div className="legal-note">
        ログインによりサーバー側にユーザー情報が保存されます（例: ハンドル、表示名、フォロー関係）。
        メール通知を有効化した場合は、通知先としてメールアドレスを保存します。
      </div>
    </section>

    <section className="legal-section">
      <h2>4. 第三者サービス / Third-Party Services</h2>
      <p>
        本サービスは以下の第三者サービスを使用します：
      </p>
      <ul>
        <li>Replicate (画像生成 / Image generation)</li>
        <li>OpenAI (感情分析 / Emotion analysis)</li>
        <li>Render (APIホスティング / API hosting)</li>
        <li>GitHub Pages (フロントエンド配信 / Frontend hosting)</li>
        <li>Sentry (エラートラッキング / Error tracking) - オプション</li>
        <li>Resend / SMTP (メール通知 / Email notifications) - オプション</li>
      </ul>
    </section>

    <section className="legal-section">
      <h2>5. お問い合わせ / Contact</h2>
      <p>
        プライバシーに関するご質問は、GitHubリポジトリのIssueにてお問い合わせください。
      </p>
      <p>
        For privacy-related questions, please contact us via GitHub repository Issues.
      </p>
    </section>
  </div>
);
