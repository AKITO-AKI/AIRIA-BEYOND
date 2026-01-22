export const PrivacyPolicy = () => (
  <div className="legal-page" style={{
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'sans-serif',
    lineHeight: '1.6'
  }}>
    <h1>プライバシーポリシー / Privacy Policy</h1>
    
    <section style={{ marginTop: '2rem' }}>
      <h2>1. 収集する情報 / Information We Collect</h2>
      <ul>
        <li>セッションデータ（気分、時間） / Session data (mood, duration)</li>
        <li>生成された画像・音楽 / Generated images and music</li>
        <li>アクセスログ / Access logs</li>
        <li>パフォーマンス指標 / Performance metrics</li>
      </ul>
    </section>

    <section style={{ marginTop: '2rem' }}>
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

    <section style={{ marginTop: '2rem' }}>
      <h2>3. データの保存 / Data Storage</h2>
      <p>
        ユーザーデータは主にブラウザのローカルストレージに保存されます。
        サーバー側では一時的な処理のみが行われます。
      </p>
      <p>
        User data is primarily stored in browser's local storage. 
        Server-side processing is temporary only.
      </p>
    </section>

    <section style={{ marginTop: '2rem' }}>
      <h2>4. 第三者サービス / Third-Party Services</h2>
      <p>
        本サービスは以下の第三者サービスを使用します：
      </p>
      <ul>
        <li>Replicate (画像生成 / Image generation)</li>
        <li>OpenAI (感情分析 / Emotion analysis)</li>
        <li>Vercel (ホスティング / Hosting)</li>
        <li>Sentry (エラートラッキング / Error tracking) - オプション</li>
      </ul>
    </section>

    <section style={{ marginTop: '2rem' }}>
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
