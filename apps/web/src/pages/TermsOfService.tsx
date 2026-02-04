import './LegalPage.css';

export const TermsOfService = () => (
  <div className="legal-page">
    <section className="legal-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
      <h2>1. サービスの概要 / Service Overview</h2>
      <p>
        AIRIA BEYONDは、AI搭載の感情分析・クラシック音楽・絵画生成アプリケーションです。
        ユーザーの感情状態を分析し、それに基づいてクラシック音楽や絵画を生成します。
      </p>
      <p>
        AIRIA BEYOND is an AI-powered application for emotion analysis, classical music, 
        and painting generation. It analyzes users' emotional states and generates classical 
        music and paintings based on the analysis.
      </p>
    </section>

    <section className="legal-section">
      <h2>2. データの取り扱い / Data Handling</h2>
      <p>
        個人を特定できる情報は送信されません。セッションデータ、生成された画像・音楽は
        ブラウザのローカルストレージに保存されます。
      </p>
      <p>
        No personally identifiable information is transmitted. Session data, generated 
        images and music are stored in browser's local storage.
      </p>
    </section>

    <section className="legal-section">
      <h2>3. 使用制限 / Usage Restrictions</h2>
      <p>
        本サービスは個人的な使用のみを目的としています。商用利用には事前の許可が必要です。
      </p>
      <p>
        This service is intended for personal use only. Commercial use requires prior permission.
      </p>
    </section>

    <section className="legal-section">
      <h2>4. 免責事項 / Disclaimer</h2>
      <p>
        本サービスは「現状のまま」提供されます。生成されたコンテンツの正確性や適切性について
        保証しません。
      </p>
      <p>
        This service is provided "as is". We do not guarantee the accuracy or appropriateness 
        of generated content.
      </p>
    </section>

    <div className="legal-note">
      プレリリース期間中は仕様が更新される場合があります。重要な変更はアプリ内のお知らせで通知します。
    </div>
  </div>
);
