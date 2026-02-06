import React from 'react';
import './LandingRoom.css';

type Props = {
  onStart: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
};

const LandingRoom: React.FC<Props> = ({ onStart, onOpenTerms, onOpenPrivacy }) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="room-content landing-room">
      <div className="landing-hero" data-no-swipe="true">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <div className="landing-hero-toprow">
              <div className="landing-eyebrow">MOOD → IMAGE → MUSIC</div>
              {(onOpenPrivacy || onOpenTerms) && (
                <div className="landing-legal" aria-label="Legal">
                  {onOpenPrivacy ? (
                    <button type="button" className="landing-legal-link" onClick={onOpenPrivacy}>
                      Privacy
                    </button>
                  ) : null}
                  {onOpenPrivacy && onOpenTerms ? (
                    <span className="landing-legal-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {onOpenTerms ? (
                    <button type="button" className="landing-legal-link" onClick={onOpenTerms}>
                      Terms
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            <h1 className="landing-title">
              AIRIA BEYOND
              <span className="landing-title-sub">感情を、作品に変える。</span>
            </h1>
            <p className="landing-lead">
              その日の気分を記録して、抽象画とクラシック風の音楽へ。
              <br />
              “言葉にならない”を、見える・聴ける形にして保存します。
            </p>

            <div className="landing-cta">
              <button
                className="btn btn-primary landing-cta-primary"
                onClick={() => {
                  try {
                    window.location.hash = '#signup';
                  } catch {
                    // ignore
                  }
                  onStart();
                }}
              >
                無料で新規登録
              </button>
              <button
                className="btn landing-cta-secondary"
                onClick={() => {
                  try {
                    window.location.hash = '#login';
                  } catch {
                    // ignore
                  }
                  onStart();
                }}
              >
                ログイン
              </button>
              <button className="btn landing-cta-secondary" onClick={() => scrollTo('landing-how')}
                aria-label="AIRIAの使い方へスクロール"
              >
                どうやって動く？
              </button>
            </div>

            <div className="landing-meta">
              <span className="landing-chip">プレリリース</span>
              <span className="landing-chip">Email / Password</span>
              <span className="landing-chip">生成失敗でも止めない設計</span>
              <span className="landing-chip">最短ルート：ログイン → 「創作から」</span>
            </div>

            <div className="landing-signup-note">
              初めての方は「無料で新規登録」からメール/パスワードを作成 → その後ログインしてください。
            </div>
          </div>

          <div className="landing-hero-cover" aria-label="サンプルプレビュー">
            <div className="landing-cover-card">
              <div className="landing-cover-top">
                <div className="landing-cover-kicker">Today’s Session</div>
                <div className="landing-cover-date">{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
              </div>
              <div className="landing-cover-title">静けさと余白</div>
              <div className="landing-cover-sub">穏やか / 3:00 / Focus 0.62</div>

              <div className="landing-cover-image" role="img" aria-label="生成イメージのモック" />

              <div className="landing-cover-bottom">
                <div className="landing-cover-pills">
                  <span className="landing-pill">Valence</span>
                  <span className="landing-pill">Arousal</span>
                  <span className="landing-pill">Motif</span>
                </div>
                <div className="landing-cover-wave" aria-hidden="true">
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                  <div className="landing-wave-bar" />
                </div>
              </div>
            </div>

            <div className="landing-cover-note">
              これは体験イメージです。実際の生成はあなたの入力に合わせて変化します。
            </div>
          </div>
        </div>
      </div>

      <section className="landing-section" id="landing-how">
        <div className="landing-section-head">
          <h2 className="landing-h2">体験は“記事”のように読み進められる</h2>
          <p className="landing-sub">
            AIRIAは、ただの生成ツールではなく「自分の状態を読み解くための記録」です。
            迷いにくい導線と、気持ちよく続くUIを優先しました。
          </p>
        </div>

        <div className="landing-steps" data-no-swipe="true">
          <article className="landing-step">
            <div className="landing-step-no">01</div>
            <h3 className="landing-h3">気分を入力</h3>
            <p className="landing-p">短い質問に答えるだけ。言語化が苦手でもOK。</p>
          </article>
          <article className="landing-step">
            <div className="landing-step-no">02</div>
            <h3 className="landing-h3">抽象画を生成</h3>
            <p className="landing-p">色・構図・質感で、その日の“温度”を可視化します。</p>
          </article>
          <article className="landing-step">
            <div className="landing-step-no">03</div>
            <h3 className="landing-h3">音楽を生成</h3>
            <p className="landing-p">クラシック風の短編。再生バーからすぐ聴けます。</p>
          </article>
          <article className="landing-step">
            <div className="landing-step-no">04</div>
            <h3 className="landing-h3">保存・共有</h3>
            <p className="landing-p">Socialに公開、反応を受け取る。非公開・削除も可能です。</p>
          </article>
        </div>

        <div className="landing-divider" />

        <div className="landing-grid" data-no-swipe="true">
          <article className="landing-card">
            <h3 className="landing-h3">止まらない体験</h3>
            <p className="landing-p">生成が失敗しても、placeholderや緊急MIDIで進行します。待ち時間のストレスを最小化。</p>
          </article>
          <article className="landing-card">
            <h3 className="landing-h3">説明可能性</h3>
            <p className="landing-p">“なぜこの作品になったか”を見える形で提示。ブラックボックス感を減らします。</p>
          </article>
          <article className="landing-card">
            <h3 className="landing-h3">運用前提の設計</h3>
            <p className="landing-p">OAuth-only、レート制限、通知（任意）など、プレリリースでも破綻しにくい土台を用意。</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-section-narrow">
        <div className="landing-section-head">
          <h2 className="landing-h2">コンセプト</h2>
          <p className="landing-sub">“感情を作品に変える”は、自己理解の入り口になる。</p>
        </div>

        <article className="landing-article" data-no-swipe="true">
          <p className="landing-article-p">
            気分は、言葉で説明しきれないことが多い。AIRIAは、入力を起点に「視覚」と「音楽」でその輪郭をつくります。
            生成物は正解ではなく、あなたが自分を読み解くための“鏡”。
          </p>
          <p className="landing-article-p">
            だからUIは、派手さよりも継続性を優先。余白、静けさ、そして必要なときだけ現れる強い導線。
            アプリ全体がひとつの短い文章のように流れる設計です。
          </p>
          <div className="landing-quote">
            <div className="landing-quote-mark" aria-hidden="true">“</div>
            <div>
              <div className="landing-quote-text">今日を作品として保存できると、気分は“消費”ではなく“蓄積”になる。</div>
              <div className="landing-quote-sub">AIRIA BEYOND / Design note</div>
            </div>
          </div>
        </article>
      </section>

      <section className="landing-section landing-bottom" data-no-swipe="true">
        <div className="landing-bottom-inner">
          <div>
            <h2 className="landing-h2">準備はできましたか？</h2>
            <p className="landing-sub">ログインして、最初のセッションを始めましょう。</p>
          </div>
          <div className="landing-bottom-actions">
            <button className="btn btn-primary" onClick={onStart}>ログインしてはじめる</button>
            <button className="btn" onClick={() => scrollTo('landing-how')}>もう一度読む</button>
          </div>
        </div>

        <footer className="landing-footer">
          <div className="landing-footer-row">
            <div className="landing-footer-brand">AIRIA BEYOND</div>
            <div className="landing-footer-note">Pre-release / OAuth-only</div>
          </div>
          {(onOpenPrivacy || onOpenTerms) && (
            <div className="landing-footer-links" aria-label="Legal">
              {onOpenPrivacy ? (
                <button type="button" className="landing-footer-link" onClick={onOpenPrivacy}>
                  プライバシー
                </button>
              ) : null}
              {onOpenTerms ? (
                <button type="button" className="landing-footer-link" onClick={onOpenTerms}>
                  利用規約
                </button>
              ) : null}
            </div>
          )}
        </footer>
      </section>
    </div>
  );
};

export default LandingRoom;
