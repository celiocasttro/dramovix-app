import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const DEFAULT_COVER =
  "https://placehold.co/600x800/171721/ffffff?text=DRAMOVIX";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getCover(item = {}) {
  const title = normalizeText(item.title || item.name || "");

  if (title.includes("sireno") || title.includes("cortejar")) {
    return "/Ensinei%20um%20Sireno%20a%20Cortejar%E2%80%A6%20e%20Agora%20Sou%20Sua.jpg";
  }

  return (
    item.cover_url ||
    item.image ||
    item.poster_url ||
    item.poster ||
    DEFAULT_COVER
  );
}

function isHlsUrl(url = "") {
  return /\.m3u8(?:$|[?#])/i.test(url);
}

function getEmbedUrl(url = "") {
  const value = String(url).trim();

  const ufo = value.match(
    /^https?:\/\/(?:www\.)?ufoload\.com\/(?:e|v)\/([a-zA-Z0-9_-]+)/i
  );

  if (ufo) return `https://ufoload.com/e/${ufo[1]}`;

  const archive = value.match(
    /^https?:\/\/(?:www\.)?archive\.org\/(?:details|embed)\/([a-zA-Z0-9._-]+)/i
  );

  if (archive) return `https://archive.org/embed/${archive[1]}`;

  const anon = value.match(
    /^https?:\/\/(?:www\.)?anonmp4\.(art|to)\/(?:v|embed)\/([a-zA-Z0-9_-]+)/i
  );

  if (anon) return `https://anonmp4.${anon[1]}/embed/${anon[2]}`;

  return "";
}

function episodeTitle(episode, index) {
  return (
    episode.title ||
    episode.name ||
    `Episódio ${episode.episode_number ?? index + 1}`
  );
}

export default function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [error, setError] = useState("");
  const [playerError, setPlayerError] = useState("");
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("dramovix-favorites") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      "dramovix-favorites",
      JSON.stringify(favorites)
    );
  }, [favorites]);

  // Carrega somente a minissérie do Sireno.
  useEffect(() => {
    let cancelled = false;

    async function loadSeries() {
      setLoading(true);
      setError("");

      const { data, error: dbError } = await supabase
        .from("series")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (dbError) {
        console.error("Erro ao carregar minissérie:", dbError);
        setError(
          "Não foi possível carregar a minissérie. Confira a tabela series no Supabase."
        );
        setLoading(false);
        return;
      }

      const found = (data || []).find((item) => {
        const title = normalizeText(item.title || item.name || "");
        return title.includes("sireno") || title.includes("cortejar");
      });

      if (!found) {
        setError(
          "A minissérie do Sireno não foi encontrada na tabela series do Supabase. Confira o título cadastrado."
        );
        setLoading(false);
        return;
      }

      setSeries({
        ...found,
        title: found.title || found.name || "Minissérie do Sireno",
        description: found.description || "",
        image: getCover(found),
        category: found.genre || found.category || "Romance",
      });

      setLoading(false);
    }

    loadSeries();

    return () => {
      cancelled = true;
    };
  }, []);

  // Carrega os episódios da minissérie.
  useEffect(() => {
    if (!series) return undefined;

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);
      setEpisodes([]);

      const { data, error: dbError } = await supabase
        .from("episodes")
        .select("*")
        .eq("series_id", series.id)
        .order("episode_number", { ascending: true });

      if (cancelled) return;

      if (dbError) {
        console.error("Erro ao carregar episódios:", dbError);
        setError(
          "Não foi possível carregar os episódios. Confira a tabela episodes no Supabase."
        );
      } else {
        setEpisodes(data || []);
      }

      setEpisodesLoading(false);
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [series]);

  // Reproduz vídeos diretos e arquivos HLS.
  useEffect(() => {
    if (!playerOpen || !currentEpisode?.url) {
      return undefined;
    }

    const url = currentEpisode.url;

    // Os serviços incorporados são reproduzidos pelo iframe.
    if (getEmbedUrl(url)) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let hls = null;

    setPlayerError("");

    function playVideo() {
      const result = video.play();

      if (result?.catch) {
        result.catch((err) => {
          console.warn("Reprodução automática:", err);

          if (!cancelled && err.name === "NotAllowedError") {
            setPlayerError(
              "Toque no botão de reprodução do vídeo para começar."
            );
          }
        });
      }
    }

    if (isHlsUrl(url)) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) playVideo();
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!cancelled && data.fatal) {
            setPlayerError(
              "Não foi possível reproduzir o vídeo. Confira se o link está válido."
            );
          }
        });
      } else if (
        video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        video.src = url;
        video.load();
        playVideo();
      } else {
        setPlayerError("Este navegador não suporta este formato de vídeo.");
      }
    } else {
      video.src = url;
      video.load();
      playVideo();
    }

    return () => {
      cancelled = true;

      if (hls) {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playerOpen, currentEpisode]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  function openEpisode(episode, index) {
    const url = String(
      episode.video_url ||
        episode.stream_url ||
        episode.url ||
        ""
    ).trim();

    setPlayerError("");

    setCurrentEpisode({
      ...episode,
      url,
      title: episodeTitle(episode, index),
    });

    setPlayerOpen(true);

    if (!url) {
      setPlayerError(
        "Este episódio ainda não tem um link de vídeo cadastrado no Supabase."
      );
    }
  }

  function watchSeries() {
    if (episodesLoading) return;

    if (episodes.length === 0) {
      setError(
        "Ainda não há episódios cadastrados para esta minissérie no Supabase."
      );
      return;
    }

    const firstEpisode = episodes.find(
      (episode) =>
        episode.video_url || episode.stream_url || episode.url
    );

    if (!firstEpisode) {
      setError(
        "Os episódios foram encontrados, mas nenhum possui um link de vídeo válido."
      );
      return;
    }

    const index = episodes.findIndex(
      (episode) => String(episode.id) === String(firstEpisode.id)
    );

    setError("");
    openEpisode(firstEpisode, index);
  }

  function playNextEpisode() {
    if (!currentEpisode) return;

    const index = episodes.findIndex(
      (episode) => String(episode.id) === String(currentEpisode.id)
    );

    const next = episodes[index + 1];

    if (!next) {
      setPlayerError("Você chegou ao último episódio da minissérie.");
      return;
    }

    const nextIndex = index + 1;

    setPlayerError("");

    setCurrentEpisode({
      ...next,
      url: String(
        next.video_url || next.stream_url || next.url || ""
      ).trim(),
      title: episodeTitle(next, nextIndex),
    });
  }

  function closePlayer() {
    setPlayerOpen(false);
    setCurrentEpisode(null);
    setPlayerError("");

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }

  function toggleFavorite() {
    if (!series) return;

    setFavorites((previous) =>
      previous.includes(String(series.id))
        ? previous.filter((id) => id !== String(series.id))
        : [...previous, String(series.id)]
    );
  }

  const isFavorite = series
    ? favorites.includes(String(series.id))
    : false;

  return (
    <div className="dv-app">
      <style>{`
        :root {
          color-scheme: dark;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #090910;
          color: #f7f7fb;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: #090910;
        }

        button { font: inherit; cursor: pointer; }

        .dv-app {
          min-height: 100vh;
          color: #f7f7fb;
          background:
            radial-gradient(ellipse at top, rgba(99,42,143,.17), transparent 48%),
            #090910;
        }

        .dv-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(9,9,16,.94);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid #242432;
        }

        .dv-header-inner {
          max-width: 1100px;
          margin: auto;
          padding: 17px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dv-brand {
          border: 0;
          padding: 0;
          background: none;
          color: white;
          font-size: 25px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .dv-brand span { color: #bd5cff; }

        .dv-main {
          width: min(1100px, 100%);
          margin: auto;
          padding: 30px 20px 55px;
        }

        .dv-heading {
          margin-bottom: 24px;
        }

        .dv-heading span {
          color: #d49aff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .dv-heading h1 {
          font-size: clamp(28px, 5vw, 43px);
          line-height: 1.15;
          margin: 10px 0;
        }

        .dv-muted {
          color: #aaa8ba;
          line-height: 1.7;
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }

        .dv-card {
          overflow: hidden;
          border: 1px solid #30263a;
          border-radius: 16px;
          background: #12121b;
        }

        .dv-card-image {
          display: block;
          width: 100%;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          background: #171721;
        }

        .dv-card-info { padding: 16px; }

        .dv-card-info h2 {
          font-size: 16px;
          line-height: 1.45;
          margin: 0 0 10px;
        }

        .dv-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 10px;
          padding: 13px 17px;
          background: #9238c8;
          color: white;
          font-weight: 800;
        }

        .dv-primary-button:hover { background: #aa4ce1; }

        .dv-primary-button:disabled {
          opacity: .5;
          cursor: wait;
        }

        .dv-detail {
          display: grid;
          grid-template-columns: minmax(190px, 300px) minmax(0, 1fr);
          gap: 30px;
          align-items: start;
        }

        .dv-detail-cover {
          display: block;
          width: 100%;
          max-height: 500px;
          object-fit: cover;
          border-radius: 16px;
          border: 1px solid #343041;
        }

        .dv-detail-content { min-width: 0; }

        .dv-detail-content h1 {
          font-size: clamp(27px, 4vw, 42px);
          line-height: 1.2;
          overflow-wrap: anywhere;
          margin: 0 0 14px;
        }

        .dv-category {
          display: inline-block;
          color: #d49aff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .dv-description {
          color: #c1bdcf;
          line-height: 1.8;
          margin-bottom: 22px;
        }

        .dv-detail-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
        }

        .dv-favorite-button {
          border: 1px solid #383446;
          border-radius: 10px;
          width: 46px;
          height: 46px;
          color: #c9c4d6;
          background: #1b1925;
          font-size: 25px;
        }

        .dv-favorite-button.active {
          color: #ff6eaa;
          border-color: #6f304f;
        }

        .dv-notice, .dv-empty {
          padding: 18px;
          border-radius: 12px;
          line-height: 1.7;
          margin: 15px 0;
        }

        .dv-notice {
          color: #ffe0e8;
          background: #29151f;
          border: 1px solid #5d2b3c;
        }

        .dv-empty {
          color: #aaa8ba;
          text-align: center;
          background: #12121b;
          border: 1px dashed #383447;
        }

        .dv-player-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          background: rgba(0,0,0,.97);
          backdrop-filter: blur(12px);
        }

        .dv-player-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(100%, 430px);
          max-height: 98dvh;
          overflow: auto;
          border: 1px solid #383044;
          border-radius: 16px;
          background: #101018;
          padding: 12px;
        }

        .dv-player-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 2px 0 12px;
        }

        .dv-player-header h2 {
          font-size: 14px;
          line-height: 1.4;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .dv-player-close {
          flex-shrink: 0;
          border: 1px solid #464051;
          background: #201d29;
          color: white;
          border-radius: 9px;
          width: 38px;
          height: 38px;
          font-size: 24px;
        }

        .dv-video-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          max-height: calc(98dvh - 125px);
          margin: auto;
          background: #000;
          border-radius: 10px;
          overflow: hidden;
        }

        .dv-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          background: #000;
          border: 0;
        }

        .dv-player-error {
          color: #ffb7c5;
          background: #29151f;
          border: 1px solid #5d2b3c;
          border-radius: 10px;
          padding: 12px;
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .dv-next {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }

        .dv-footer {
          padding: 25px 20px;
          text-align: center;
          color: #777487;
          border-top: 1px solid #242432;
          font-size: 12px;
        }

        @media (max-width: 700px) {
          .dv-header-inner { padding: 14px; }
          .dv-brand { font-size: 22px; }
          .dv-main { padding: 24px 14px 40px; }
          .dv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .dv-card-info { padding: 12px; }
          .dv-card-info h2 { font-size: 13px; }
          .dv-detail { grid-template-columns: 1fr; gap: 20px; }
          .dv-detail-cover { width: min(70%, 260px); margin: auto; }
          .dv-detail-content { text-align: center; }
          .dv-detail-actions { justify-content: center; }
          .dv-video-wrap { max-height: calc(98dvh - 115px); }
        }
      `}</style>

      <header className="dv-header">
        <div className="dv-header-inner">
          <button
            className="dv-brand"
            onClick={() => setShowDetails(false)}
          >
            DRAMO<span>VIX</span>
          </button>
        </div>
      </header>

      <main className="dv-main">
        {loading ? (
          <div className="dv-empty">Carregando minissérie...</div>
        ) : error && !series ? (
          <div className="dv-notice">{error}</div>
        ) : series ? (
          <>
            {!showDetails ? (
              <>
                <div className="dv-heading">
                  <span>Uma história para você</span>
                  <h1>Minisséries</h1>
                  <p className="dv-muted">
                    Assista à sua história favorita no DRAMOVIX.
                  </p>
                </div>

                <div className="dv-grid">
                  <article className="dv-card">
                    <button
                      onClick={() => {
                        setShowDetails(true);
                        setError("");
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: 0,
                        border: 0,
                        background: "transparent",
                      }}
                      aria-label={`Abrir ${series.title}`}
                    >
                      <img
                        className="dv-card-image"
                        src={series.image}
                        alt={series.title}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = DEFAULT_COVER;
                        }}
                      />
                    </button>

                    <div className="dv-card-info">
                      <h2>{series.title}</h2>
                      <button
                        className="dv-primary-button"
                        style={{ width: "100%" }}
                        onClick={() => {
                          setShowDetails(true);
                          setError("");
                        }}
                      >
                        Ver minissérie
                      </button>
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <>
                <button
                  className="dv-primary-button"
                  style={{ marginBottom: 22 }}
                  onClick={() => {
                    setShowDetails(false);
                    setError("");
                  }}
                >
                  ← Voltar
                </button>

                <section className="dv-detail">
                  <img
                    className="dv-detail-cover"
                    src={series.image}
                    alt={series.title}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_COVER;
                    }}
                  />

                  <div className="dv-detail-content">
                    <span className="dv-category">
                      {series.category}
                    </span>

                    <h1>{series.title}</h1>

                    <p className="dv-description">
                      {series.description ||
                        "Prepare-se para acompanhar esta história do começo ao fim."}
                    </p>

                    <p className="dv-muted">
                      {episodesLoading
                        ? "Carregando vídeo..."
                        : episodes.length
                        ? `${episodes.length} episódio(s) disponível(is)`
                        : "O vídeo ainda não está disponível."}
                    </p>

                    <div className="dv-detail-actions">
                      <button
                        className="dv-primary-button"
                        onClick={watchSeries}
                        disabled={episodesLoading}
                      >
                        ▶ ASSISTIR MINISSÉRIE
                      </button>

                      <button
                        className={`dv-favorite-button ${
                          isFavorite ? "active" : ""
                        }`}
                        onClick={toggleFavorite}
                        title="Favoritos"
                        aria-label="Adicionar ou remover dos favoritos"
                      >
                        {isFavorite ? "♥" : "♡"}
                      </button>
                    </div>

                    {error && (
                      <div className="dv-notice">{error}</div>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        ) : (
          <div className="dv-empty">
            Não foi possível encontrar a minissérie.
          </div>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX · Sempre tem uma nova história.
      </footer>

      {playerOpen && (
        <div
          className="dv-player-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePlayer();
            }
          }}
        >
          <div className="dv-player-panel">
            <div className="dv-player-header">
              <h2>{currentEpisode?.title || series?.title || "DRAMOVIX"}</h2>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar vídeo"
              >
                ×
              </button>
            </div>

            {currentEpisode?.url ? (
              <div className="dv-video-wrap">
                {getEmbedUrl(currentEpisode.url) ? (
                  <iframe
                    key={currentEpisode.url}
                    className="dv-video"
                    src={getEmbedUrl(currentEpisode.url)}
                    title={currentEpisode.title || "Vídeo DRAMOVIX"}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="eager"
                  />
                ) : (
                  <video
                    key={currentEpisode.url}
                    ref={videoRef}
                    className="dv-video"
                    controls
                    playsInline
                    autoPlay
                    preload="metadata"
                    onEnded={playNextEpisode}
                    onError={() => {
                      if (!isHlsUrl(currentEpisode?.url || "")) {
                        setPlayerError(
                          "Não foi possível reproduzir o vídeo. Verifique o link cadastrado no Supabase."
                        );
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="dv-empty">
                Este episódio não possui link de vídeo.
              </div>
            )}

            {playerError && (
              <div className="dv-player-error">{playerError}</div>
            )}

            {episodes.length > 1 && (
              <div className="dv-next">
                <button
                  className="dv-primary-button"
                  onClick={playNextEpisode}
                  disabled={
                    episodes.findIndex(
                      (episode) =>
                        String(episode.id) ===
                        String(currentEpisode?.id)
                    ) >=
                    episodes.length - 1
                  }
                >
                  Próximo episódio →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
