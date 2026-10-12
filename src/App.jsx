import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const PLAYLISTS = {
  br: {
    name: "Canais do Brasil",
    url: "https://iptv-org.github.io/iptv/countries/br.m3u",
  },
  world: {
    name: "Canais internacionais",
    url: "https://iptv-org.github.io/iptv/index.m3u",
  },
  categories: {
    name: "Categorias",
    url: "https://iptv-org.github.io/iptv/index.category.m3u",
  },
  languages: {
    name: "Idiomas",
    url: "https://iptv-org.github.io/iptv/index.language.m3u",
  },
};

const DEFAULT_SERIES_COVER =
  "https://placehold.co/600x800/171721/ffffff?text=Dramovix";

const DEFAULT_MOVIE_COVER =
  "https://placehold.co/600x800/171721/ffffff?text=Filme";

const DEFAULT_CHANNEL_LOGO =
  "https://placehold.co/100x100/171721/ffffff?text=TV";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSeriesCover(item = {}) {
  const title = normalizeText(item.title || item.name || "");

  if (title.includes("sireno") || title.includes("cortejar")) {
    return "/Ensinei%20um%20Sireno%20a%20Cortejar%E2%80%A6%20e%20Agora%20Sou%20Sua.jpg";
  }

  if (
    title.includes("baba do herdeiro") ||
    title.includes("herdeiro virou marido")
  ) {
    return "/baba-do-herdeiro.png";
  }

  return (
    item.cover_url ||
    item.image ||
    item.poster_url ||
    item.poster ||
    DEFAULT_SERIES_COVER
  );
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const nameMatch = line.match(/,(.*)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const idMatch = line.match(/tvg-id="([^"]*)"/i);

      current = {
        id: `playlist-${channels.length}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        name: nameMatch?.[1]?.trim() || "Canal sem nome",
        title: nameMatch?.[1]?.trim() || "Canal sem nome",
        logo: logoMatch?.[1] || DEFAULT_CHANNEL_LOGO,
        category: groupMatch?.[1] || "Outros",
        tvgId: idMatch?.[1] || "",
        source: "playlist",
        stream_url: "",
      };
    } else if (
      !line.startsWith("#") &&
      current &&
      /^https?:\/\//i.test(line)
    ) {
      current.stream_url = line;
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

function getErrorDetails(error) {
  if (!error) return "Erro desconhecido.";

  return [
    error.message,
    error.details,
    error.hint,
    error.code ? `Código: ${error.code}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

function isHlsUrl(url = "") {
  return /\.m3u8(?:$|[?#])/i.test(url);
}

// UFOLOAD
function isUfoLoadUrl(url = "") {
  return /^https?:\/\/(?:www\.)?ufoload\.com\/(?:e|v)\/[a-zA-Z0-9_-]+(?:[/?#].*)?$/i.test(
    String(url).trim()
  );
}

function getUfoLoadEmbedUrl(url = "") {
  const match = String(url)
    .trim()
    .match(
      /^https?:\/\/(?:www\.)?ufoload\.com\/(?:e|v)\/([a-zA-Z0-9_-]+)/i
    );

  return match ? `https://ufoload.com/e/${match[1]}` : "";
}

// INTERNET ARCHIVE
function isInternetArchiveUrl(url = "") {
  return /^https?:\/\/(?:www\.)?archive\.org\/(?:details|embed)\/[a-zA-Z0-9._-]+(?:[/?#].*)?$/i.test(
    String(url).trim()
  );
}

function getInternetArchiveEmbedUrl(url = "") {
  const match = String(url)
    .trim()
    .match(
      /^https?:\/\/(?:www\.)?archive\.org\/(?:details|embed)\/([a-zA-Z0-9._-]+)/i
    );

  return match ? `https://archive.org/embed/${match[1]}` : "";
}

// ANONMP4: converte /v/ID para /embed/ID.
function isAnonMP4Url(url = "") {
  return /^https?:\/\/(?:www\.)?anonmp4\.(?:art|to)\/(?:v|embed)\/[a-zA-Z0-9_-]+(?:[/?#].*)?$/i.test(
    String(url).trim()
  );
}

function getAnonMP4EmbedUrl(url = "") {
  const match = String(url)
    .trim()
    .match(
      /^https?:\/\/(?:www\.)?(anonmp4\.(?:art|to))\/(?:v|embed)\/([a-zA-Z0-9_-]+)/i
    );

  if (!match) return "";

  return `https://${match[1]}/embed/${match[2]}`;
}

function isEmbeddedVideoUrl(url = "") {
  return (
    isUfoLoadUrl(url) ||
    isInternetArchiveUrl(url) ||
    isAnonMP4Url(url)
  );
}

function getEmbeddedVideoUrl(url = "") {
  if (isUfoLoadUrl(url)) {
    return getUfoLoadEmbedUrl(url);
  }

  if (isInternetArchiveUrl(url)) {
    return getInternetArchiveEmbedUrl(url);
  }

  if (isAnonMP4Url(url)) {
    return getAnonMP4EmbedUrl(url);
  }

  return "";
}

function normalizeEpisodeTitle(episode, index) {
  return (
    episode.title ||
    episode.name ||
    `Episódio ${episode.episode_number ?? index + 1}`
  );
}

export default function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const mediaRecoveryRef = useRef(false);

  const [section, setSection] = useState("Início");

  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [dbChannels, setDbChannels] = useState([]);
  const [playlistChannels, setPlaylistChannels] = useState([]);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [currentVideo, setCurrentVideo] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [channelCategory, setChannelCategory] = useState("Todas");
  const [channelSource, setChannelSource] = useState("br");

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("dramovix-favorites") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  const [error, setError] = useState("");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError("");

      const [seriesResult, moviesResult, channelsResult] =
        await Promise.all([
          supabase
            .from("series")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.from("movies").select("*"),
          supabase.from("channels").select("*"),
        ]);

      if (cancelled) return;

      if (seriesResult.error) {
        console.error(
          "Erro ao carregar minisséries:",
          getErrorDetails(seriesResult.error)
        );

        setError(
          "Não foi possível carregar as minisséries. Confira a tabela series e suas permissões no Supabase."
        );

        setLoading(false);
        return;
      }

      setSeries(
        (seriesResult.data || []).map((item) => ({
          ...item,
          id: item.id,
          title: item.title || item.name || "Minissérie sem título",
          category: item.genre || item.category || "Romance",
          description: item.description || "",
          image: getSeriesCover(item),
          type: "series",
        }))
      );

      if (moviesResult.error) {
        console.warn(
          "Não foi possível carregar os filmes:",
          getErrorDetails(moviesResult.error)
        );
        setMovies([]);
      } else {
        setMovies(
          (moviesResult.data || []).map((item) => ({
            ...item,
            id: item.id,
            title: item.title || item.name || "Filme sem título",
            image:
              item.cover_url ||
              item.poster_url ||
              item.image ||
              DEFAULT_MOVIE_COVER,
            video_url:
              item.video_url || item.stream_url || item.url || "",
            type: "movie",
          }))
        );
      }

      if (channelsResult.error) {
        console.warn(
          "Não foi possível carregar os canais do Supabase:",
          getErrorDetails(channelsResult.error)
        );
        setDbChannels([]);
      } else {
        setDbChannels(
          (channelsResult.data || []).map((item) => ({
            ...item,
            id: `db-${item.id}`,
            name: item.name || item.title || "Canal sem nome",
            logo: item.logo || item.logo_url || DEFAULT_CHANNEL_LOGO,
            stream_url:
              item.stream_url || item.video_url || item.url || "",
            category: item.category || "Outros",
            source: "database",
          }))
        );
      }

      setLoading(false);
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dramovix-favorites",
        JSON.stringify(favorites)
      );
    } catch (err) {
      console.warn("Não foi possível salvar os favoritos:", err);
    }
  }, [favorites]);

  useEffect(() => {
    if (!selectedSeries) {
      setEpisodes([]);
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);
      setEpisodes([]);

      const { data, error: episodeError } = await supabase
        .from("episodes")
        .select("*")
        .eq("series_id", selectedSeries.id)
        .order("episode_number", { ascending: true });

      if (cancelled) return;

      if (episodeError) {
        console.error(
          "Erro ao carregar episódios:",
          getErrorDetails(episodeError)
        );
        setEpisodes([]);
      } else {
        setEpisodes(data || []);
      }

      setEpisodesLoading(false);
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeries]);

  useEffect(() => {
    const playlist = PLAYLISTS[channelSource];

    if (!playlist) return undefined;

    const controller = new AbortController();

    async function loadPlaylist() {
      setPlaylistLoading(true);

      try {
        const response = await fetch(playlist.url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP ${response.status}`);
        }

        const text = await response.text();
        const parsedChannels = parseM3U(text);

        if (!controller.signal.aborted) {
          setPlaylistChannels(parsedChannels);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Erro ao carregar playlist:", err);
          setPlaylistChannels([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPlaylistLoading(false);
        }
      }
    }

    loadPlaylist();

    return () => controller.abort();
  }, [channelSource]);

  function openPlayer(item, type = "movie") {
    const videoUrl = String(
      item.video_url ||
        item.stream_url ||
        item.url ||
        item.video ||
        ""
    ).trim();

    setPlayerError("");
    mediaRecoveryRef.current = false;

    setCurrentVideo({
      ...item,
      url: videoUrl,
      type,
      name: item.name || item.title || "DRAMOVIX",
    });

    setPlayerOpen(true);

    if (!videoUrl) {
      setPlayerError(
        "Este conteúdo ainda não possui um endereço de vídeo cadastrado."
      );
    }
  }

  function openEpisode(episode, index) {
    setSelectedEpisode(episode);
    setPlayerError("");
    mediaRecoveryRef.current = false;

    openPlayer(
      {
        ...episode,
        title: normalizeEpisodeTitle(episode, index),
        name: normalizeEpisodeTitle(episode, index),
        video_url:
          episode.video_url ||
          episode.stream_url ||
          episode.url ||
          "",
      },
      "episode"
    );
  }

  function watchSireno() {
    if (episodesLoading) return;

    setError("");

    if (!episodes.length) {
      setError(
        "Ainda não há episódios cadastrados para esta minissérie."
      );
      return;
    }

    const firstIndex = episodes.findIndex((episode) =>
      String(
        episode.video_url ||
          episode.stream_url ||
          episode.url ||
          ""
      ).trim()
    );

    if (firstIndex === -1) {
      setError(
        "Nenhum episódio possui um link de vídeo cadastrado."
      );
      return;
    }

    openEpisode(episodes[firstIndex], firstIndex);
  }

  function playNextEpisode() {
    if (!selectedEpisode || episodes.length === 0) {
      setPlayerError("Não há outro episódio disponível.");
      return;
    }

    const currentIndex = episodes.findIndex(
      (episode) =>
        String(episode.id) === String(selectedEpisode.id)
    );

    if (currentIndex < 0) {
      setPlayerError("Não foi possível identificar o episódio atual.");
      return;
    }

    const nextEpisode = episodes[currentIndex + 1];

    if (!nextEpisode) {
      setPlayerError(
        "Você chegou ao último episódio desta minissérie."
      );
      return;
    }

    setSelectedEpisode(nextEpisode);
    setPlayerError("");
    mediaRecoveryRef.current = false;

    const nextUrl = String(
      nextEpisode.video_url ||
        nextEpisode.stream_url ||
        nextEpisode.url ||
        ""
    ).trim();

    setCurrentVideo({
      ...nextEpisode,
      url: nextUrl,
      type: "episode",
      name: normalizeEpisodeTitle(nextEpisode, currentIndex + 1),
    });

    if (!nextUrl) {
      setPlayerError(
        "Este episódio ainda não possui um endereço de vídeo cadastrado."
      );
    }
  }

  function closePlayer() {
    setPlayerOpen(false);
    setCurrentVideo(null);
    setSelectedEpisode(null);
    setPlayerError("");
    mediaRecoveryRef.current = false;

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

  useEffect(() => {
    if (
      !playerOpen ||
      !currentVideo?.url ||
      !videoRef.current ||
      isEmbeddedVideoUrl(currentVideo.url)
    ) {
      return undefined;
    }

    const video = videoRef.current;
    const url = currentVideo.url;
    let cancelled = false;
    let hls = null;

    setPlayerError("");
    mediaRecoveryRef.current = false;

    function showPlaybackError(message) {
      if (!cancelled) setPlayerError(message);
    }

    function tryPlay() {
      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          if (cancelled) return;

          console.warn(
            "A reprodução automática não iniciou:",
            err
          );

          if (err.name === "NotAllowedError") {
            showPlaybackError(
              "Toque no botão de reprodução do vídeo para começar."
            );
          }
        });
      }
    }

    if (isHlsUrl(url)) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 30,
        });

        hlsRef.current = hls;
        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (!cancelled) hls.loadSource(url);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) {
            setPlayerError("");
            tryPlay();
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (cancelled || !data.fatal) return;

          console.error("Erro fatal do HLS:", {
            type: data.type,
            details: data.details,
            response: data.response,
            url,
          });

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (!mediaRecoveryRef.current) {
              mediaRecoveryRef.current = true;

              try {
                hls.recoverMediaError();
              } catch (err) {
                console.error("Falha ao recuperar mídia:", err);
                showPlaybackError(
                  "O vídeo apresentou um erro de mídia e não pôde ser recuperado."
                );
              }
            } else {
              showPlaybackError(
                "Não foi possível recuperar a reprodução deste vídeo."
              );
              hls.destroy();
            }

            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            showPlaybackError(
              "Não foi possível carregar o vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução dentro do DRAMOVIX."
            );

            hls.destroy();

            if (hlsRef.current === hls) {
              hlsRef.current = null;
            }

            return;
          }

          showPlaybackError(
            "Este vídeo não pôde ser reproduzido. Verifique o link e tente outro conteúdo."
          );

          hls.destroy();

          if (hlsRef.current === hls) {
            hlsRef.current = null;
          }
        });
      } else if (
        video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        video.src = url;
        video.load();
        tryPlay();
      } else {
        showPlaybackError(
          "Este navegador não oferece suporte à reprodução HLS."
        );
      }
    } else {
      video.src = url;
      video.load();
      tryPlay();
    }

    return () => {
      cancelled = true;

      if (hls) {
        hls.destroy();

        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playerOpen, currentVideo]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  function toggleFavorite(item, type = "series") {
    const key = `${type}-${item.id}`;

    setFavorites((previous) => {
      const alreadyFavorite = previous.some(
        (favorite) => favorite.key === key
      );

      if (alreadyFavorite) {
        return previous.filter(
          (favorite) => favorite.key !== key
        );
      }

      return [
        ...previous,
        {
          key,
          id: item.id,
          type,
          title: item.title || item.name || "Sem título",
          image:
            item.image ||
            item.cover_url ||
            item.poster_url ||
            item.logo ||
            DEFAULT_SERIES_COVER,
          item,
        },
      ];
    });
  }

  function isFavorite(item, type = "series") {
    return favorites.some(
      (favorite) => favorite.key === `${type}-${item.id}`
    );
  }

  function goHome() {
    setSection("Início");
    setSelectedSeries(null);
    setSearch("");
    setCategory("Todas");
    setError("");
  }

  const allChannels = useMemo(() => {
    const combined = [...dbChannels, ...playlistChannels];
    const seen = new Set();

    return combined.filter((channel) => {
      const url = channel.stream_url || channel.url;

      if (!url || seen.has(url)) return false;

      seen.add(url);
      return true;
    });
  }, [dbChannels, playlistChannels]);

  const seriesCategories = useMemo(
    () => [
      "Todas",
      ...new Set(
        series.map((item) => item.category).filter(Boolean)
      ),
    ],
    [series]
  );

  const channelCategories = useMemo(
    () => [
      "Todas",
      ...new Set(
        allChannels.map((item) => item.category).filter(Boolean)
      ),
    ],
    [allChannels]
  );

  const filteredSeries = useMemo(() => {
    const query = normalizeText(search);

    return series.filter((item) => {
      const matchesCategory =
        category === "Todas" || item.category === category;

      const matchesSearch =
        !query ||
        normalizeText(item.title).includes(query) ||
        normalizeText(item.description).includes(query) ||
        normalizeText(item.category).includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [series, category, search]);

  const filteredMovies = useMemo(() => {
    const query = normalizeText(search);

    return movies.filter(
      (item) =>
        !query ||
        normalizeText(item.title).includes(query) ||
        normalizeText(item.description || "").includes(query)
    );
  }, [movies, search]);

  const filteredChannels = useMemo(() => {
    const query = normalizeText(search);

    return allChannels.filter((item) => {
      const matchesCategory =
        channelCategory === "Todas" ||
        item.category === channelCategory;

      const matchesSearch =
        !query ||
        normalizeText(item.name).includes(query) ||
        normalizeText(item.category).includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [allChannels, channelCategory, search]);

  const favoriteSeries = favorites.filter(
    (favorite) => favorite.type === "series"
  );

  const favoriteMovies = favorites.filter(
    (favorite) => favorite.type === "movie"
  );

  function renderSeriesCard(item) {
    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={() => {
            setSelectedSeries(item);
            setSection("Minisséries");
            setError("");
          }}
          aria-label={`Abrir ${item.title}`}
        >
          <img
            className="dv-card-image"
            src={item.image || DEFAULT_SERIES_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_SERIES_COVER;
            }}
          />
          <span className="dv-card-play">▶</span>
        </button>

        <div className="dv-card-info">
          <span className="dv-card-category">{item.category}</span>
          <h3>{item.title}</h3>
          <p>
            {item.description ||
              "Uma nova história espera por você."}
          </p>

          <div className="dv-card-actions">
            <button
              className="dv-primary-button"
              onClick={() => {
                setSelectedSeries(item);
                setSection("Minisséries");
              }}
            >
              Ver episódios
            </button>

            <button
              className={`dv-favorite-button ${
                isFavorite(item, "series") ? "active" : ""
              }`}
              onClick={() => toggleFavorite(item, "series")}
              aria-label="Adicionar ou remover dos favoritos"
              title="Favoritos"
            >
              {isFavorite(item, "series") ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  function renderMovieCard(item) {
    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={() => openPlayer(item, "movie")}
          aria-label={`Assistir ${item.title}`}
        >
          <img
            className="dv-card-image"
            src={item.image || DEFAULT_MOVIE_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_MOVIE_COVER;
            }}
          />
          <span className="dv-card-play">▶</span>
        </button>

        <div className="dv-card-info">
          <h3>{item.title}</h3>
          <p>{item.description || "Assista no DRAMOVIX."}</p>

          <div className="dv-card-actions">
            <button
              className="dv-primary-button"
              onClick={() => openPlayer(item, "movie")}
            >
              ▶ Assistir
            </button>

            <button
              className={`dv-favorite-button ${
                isFavorite(item, "movie") ? "active" : ""
              }`}
              onClick={() => toggleFavorite(item, "movie")}
              aria-label="Adicionar ou remover dos favoritos"
              title="Favoritos"
            >
              {isFavorite(item, "movie") ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  function renderChannelCard(item) {
    return (
      <article className="dv-channel-card" key={item.id}>
        <img
          src={item.logo || DEFAULT_CHANNEL_LOGO}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = DEFAULT_CHANNEL_LOGO;
          }}
        />

        <div className="dv-channel-info">
          <h3>{item.name}</h3>
          <p>{item.category || "TV ao vivo"}</p>
        </div>

        <button
          className="dv-primary-button"
          onClick={() => openPlayer(item, "channel")}
        >
          ▶ Assistir
        </button>
      </article>
    );
  }

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
        body { margin: 0; background: #090910; }
        button, input, select { font: inherit; }
        button { cursor: pointer; }

        .dv-app {
          min-height: 100vh;
          background: radial-gradient(ellipse at top, rgba(99,42,143,.13), transparent 45%), #090910;
          color: #f7f7fb;
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
          width: min(1200px,100%);
          margin: auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .dv-brand {
          font-size: 25px;
          font-weight: 950;
          letter-spacing: 1.5px;
          color: #fff;
          border: 0;
          background: none;
          padding: 0;
        }

        .dv-brand span { color: #bd5cff; }

        .dv-nav {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          align-items: center;
        }

        .dv-nav button {
          color: #bcbcca;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 13px;
        }

        .dv-nav button:hover, .dv-nav button.active {
          color: white;
          background: #242032;
          border-color: #49315e;
        }

        .dv-main {
          width: min(1200px,100%);
          padding: 24px 20px 60px;
          margin: auto;
        }

        .dv-search {
          width: 100%;
          max-width: 500px;
          display: block;
          margin: 0 0 25px;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1px solid #303040;
          color: white;
          background: #15151f;
          outline: none;
        }

        .dv-search:focus { border-color: #b45cff; }

        .dv-hero {
          position: relative;
          overflow: hidden;
          padding: 42px;
          border-radius: 22px;
          margin-bottom: 34px;
          border: 1px solid #332443;
          background: radial-gradient(circle at 80% 15%, rgba(191,82,255,.28), transparent 35%), linear-gradient(120deg,#1b1229,#11111b 68%);
        }

        .dv-hero-label {
          color: #d49aff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .dv-hero h1 {
          font-size: clamp(32px,5vw,54px);
          line-height: 1.06;
          margin: 12px 0;
          max-width: 650px;
        }

        .dv-hero p { max-width: 560px; color: #c2bdce; line-height: 1.7; }

        /* AVISO DE DESENVOLVIMENTO */
        .dv-development-notice {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          margin: 0 0 30px;
          border: 1px solid #69418a;
          border-radius: 16px;
          background: linear-gradient(
            135deg,
            rgba(108, 47, 145, 0.25),
            rgba(25, 20, 36, 0.95)
          );
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        }

        .dv-development-icon {
          flex-shrink: 0;
          font-size: 30px;
        }

        .dv-development-notice h2 {
          margin: 0 0 10px;
          color: #e3b7ff;
          font-size: 18px;
          line-height: 1.4;
        }

        .dv-development-notice p {
          margin: 0 0 12px;
          color: #d0cada;
          font-size: 13px;
          line-height: 1.7;
        }

        .dv-development-notice strong {
          display: block;
          color: #e5c4ff;
          font-size: 13px;
          line-height: 1.6;
        }

        .dv-development-notice .dv-development-thanks {
          margin: 10px 0 0;
          color: #a9a3b8;
          font-size: 12px;
        }

        .dv-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
          margin: 30px 0 18px;
        }

        .dv-section-heading h2 { margin: 0; font-size: 23px; }
        .dv-muted { color: #aaa8ba; }

        .dv-categories {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 15px 0 24px;
        }

        .dv-categories button {
          padding: 9px 13px;
          border-radius: 999px;
          color: #c9c5d6;
          border: 1px solid #303040;
          background: #15151f;
          font-size: 13px;
        }

        .dv-categories button.active {
          background: #8e37c4;
          border-color: #b45cff;
          color: white;
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(5,minmax(0,1fr));
          gap: 18px;
        }

        .dv-card {
          min-width: 0;
          overflow: hidden;
          border-radius: 15px;
          border: 1px solid #292938;
          background: #12121b;
          transition: transform .18s,border-color .18s;
        }

        .dv-card:hover { transform: translateY(-3px); border-color: #674087; }

        .dv-card-image-button {
          display: block;
          position: relative;
          width: 100%;
          aspect-ratio: 3/4;
          padding: 0;
          border: 0;
          background: #171721;
          overflow: hidden;
        }

        .dv-card-image { display: block; width: 100%; height: 100%; object-fit: cover; }

        .dv-card-play {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%,-50%);
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(142,55,196,.92);
          color: white;
          opacity: 0;
          transition: opacity .2s;
        }

        .dv-card-image-button:hover .dv-card-play { opacity: 1; }
        .dv-card-info { padding: 13px; }

        .dv-card-info h3 {
          font-size: 14px;
          line-height: 1.4;
          margin: 5px 0 8px;
          overflow-wrap: anywhere;
        }

        .dv-card-info p { font-size: 12px; line-height: 1.5; color: #a9a7b8; margin: 0 0 12px; }

        .dv-card-category {
          color: #d09aff;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .dv-card-actions { display: flex; align-items: center; gap: 8px; }

        .dv-primary-button {
          border: 0;
          border-radius: 9px;
          padding: 10px 12px;
          background: #9238c8;
          color: white;
          font-size: 12px;
          font-weight: 750;
        }

        .dv-primary-button:hover { background: #aa4ce1; }
        .dv-primary-button:disabled { opacity: .45; cursor: not-allowed; }

        .dv-favorite-button {
          flex-shrink: 0;
          border: 1px solid #383446;
          border-radius: 9px;
          width: 38px;
          height: 38px;
          color: #c9c4d6;
          background: #1b1925;
          font-size: 22px;
        }

        .dv-favorite-button.active { color: #ff6eaa; border-color: #6f304f; }

        .dv-back-button {
          margin-bottom: 20px;
          padding: 10px 13px;
          color: white;
          border: 1px solid #383446;
          background: #17151f;
          border-radius: 9px;
        }

        .dv-detail {
          display: grid;
          grid-template-columns: minmax(180px,280px) minmax(0,1fr);
          gap: 28px;
          align-items: start;
        }

        .dv-detail-cover {
          width: 100%;
          max-height: 420px;
          object-fit: cover;
          border-radius: 16px;
          border: 1px solid #343041;
        }

        .dv-detail-content { min-width: 0; }

        .dv-detail-content h1 {
          font-size: clamp(25px,4vw,38px);
          overflow-wrap: anywhere;
          margin: 0 0 12px;
        }

        .dv-detail-content p { color: #c1bdcf; line-height: 1.7; }

        .dv-episode-list { display: grid; gap: 10px; margin-top: 20px; }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #2c2b3a;
          border-radius: 12px;
          background: #14141e;
        }

        .dv-episode-number {
          flex: 0 0 40px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #30203f;
          color: #e0b5ff;
          font-weight: 800;
        }

        .dv-episode-info { flex: 1; min-width: 0; }

        .dv-episode-info h3 {
          font-size: 14px;
          line-height: 1.4;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .dv-episode-info p { font-size: 12px; color: #9f9bad; margin: 5px 0 0; }
        .dv-episode .dv-primary-button { flex-shrink: 0; }

        .dv-channel-list {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
        }

        .dv-channel-card {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
          padding: 13px;
          border: 1px solid #2b2a38;
          border-radius: 12px;
          background: #14141e;
        }

        .dv-channel-card > img {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          border-radius: 9px;
          object-fit: contain;
          background: #20202b;
        }

        .dv-channel-info { flex: 1; min-width: 0; }
        .dv-channel-info h3 { margin: 0 0 5px; font-size: 14px; overflow-wrap: anywhere; }
        .dv-channel-info p { margin: 0; font-size: 12px; color: #a8a5b7; }
        .dv-channel-card .dv-primary-button { flex-shrink: 0; }

        .dv-notice {
          padding: 15px;
          border-radius: 12px;
          color: #e6d9f3;
          background: #21182d;
          border: 1px solid #49305c;
          line-height: 1.6;
          margin: 15px 0;
        }

        .dv-empty {
          padding: 35px 20px;
          text-align: center;
          color: #aaa8ba;
          border: 1px dashed #383447;
          border-radius: 14px;
          background: #12121b;
        }

        .dv-footer {
          padding: 25px 20px;
          text-align: center;
          color: #777487;
          border-top: 1px solid #242432;
          font-size: 12px;
        }

        .dv-player-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,.96);
          backdrop-filter: blur(12px);
        }

        .dv-player-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(100%,900px);
          max-height: 94dvh;
          overflow: auto;
          border: 1px solid #383044;
          border-radius: 16px;
          background: #101018;
          padding: 12px;
        }

        .dv-player-modal.dv-player-vertical .dv-player-panel {
          width: min(100%,420px);
          max-height: 96dvh;
        }

        .dv-player-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 2px 12px;
        }

        .dv-player-header h2 {
          font-size: 15px;
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
          font-size: 21px;
        }

        .dv-video-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dv-player-vertical .dv-video-wrap {
          aspect-ratio: 9/16;
          width: 100%;
          max-height: calc(96dvh - 100px);
          margin: 0 auto;
          flex: 0 0 auto;
          border-radius: 10px;
          background: #000;
        }

        .dv-video {
          width: 100%;
          height: 100%;
          display: block;
          background: #000;
          object-fit: contain;
          border: 0;
        }

        .dv-video-wrap iframe.dv-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          border: 0;
          background: #000;
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

        .dv-player-next { display: flex; justify-content: flex-end; margin-top: 12px; }

        @media (max-width: 1000px) {
          .dv-grid { grid-template-columns: repeat(4,minmax(0,1fr)); }
        }

        @media (max-width: 760px) {
          .dv-header-inner { padding: 12px 14px; gap: 12px; }
          .dv-brand { font-size: 22px; }
          .dv-nav { width: 100%; display: flex; flex-wrap: wrap; gap: 5px; }
          .dv-nav button { padding: 8px 9px; font-size: 12px; }
          .dv-main { padding: 18px 14px 40px; }
          .dv-hero { padding: 27px 21px; border-radius: 17px; }
          .dv-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
          .dv-card-info { padding: 10px; }
          .dv-card-info h3 { font-size: 13px; }
          .dv-card-info p { font-size: 11px; }
          .dv-detail { grid-template-columns: 1fr; gap: 20px; }
          .dv-detail-cover { width: min(65%,240px); margin: 0 auto; display: block; }
          .dv-channel-list { grid-template-columns: 1fr; }
          .dv-episode { gap: 9px; padding: 10px; }
          .dv-episode-number { flex-basis: 34px; width: 34px; height: 34px; }
          .dv-episode-info h3 { font-size: 12px; }
          .dv-episode .dv-primary-button { padding: 9px; font-size: 11px; }
          .dv-player-modal { padding: 8px; }
          .dv-player-panel { padding: 9px; }
          .dv-player-modal.dv-player-vertical .dv-player-panel { width: min(100%,420px); max-height: 98dvh; }
          .dv-player-vertical .dv-video-wrap { width: 100%; aspect-ratio: 9/16; max-height: calc(98dvh - 95px); }

          .dv-development-notice {
            gap: 11px;
            padding: 15px;
          }

          .dv-development-icon {
            font-size: 25px;
          }

          .dv-development-notice h2 {
            font-size: 16px;
          }
        }

        @media (max-width: 380px) {
          .dv-nav button { padding: 7px; font-size: 11px; }
          .dv-card-actions { gap: 5px; }
          .dv-primary-button { padding: 9px; font-size: 11px; }
          .dv-favorite-button { width: 34px; height: 34px; }
        }
      `}</style>

      <header className="dv-header">
        <div className="dv-header-inner">
          <button className="dv-brand" onClick={goHome}>
            DRAMO<span>VIX</span>
          </button>

          <nav className="dv-nav">
            {[
              "Início",
              "Minisséries",
              "Filmes",
              "TV ao vivo",
              "Favoritos",
            ].map((item) => (
              <button
                key={item}
                className={section === item ? "active" : ""}
                onClick={() => {
                  setSection(item);
                  setSelectedSeries(null);
                  setError("");
                }}
              >
                {item === "Favoritos"
                  ? `♥ Favoritos (${favorites.length})`
                  : item}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="dv-main">
        <input
          className="dv-search"
          type="search"
          placeholder="Buscar minisséries, filmes ou canais..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {error && <div className="dv-notice">{error}</div>}

        {loading && (
          <div className="dv-empty">Carregando catálogo...</div>
        )}

        {!loading && section === "Início" && (
          <>
            <section className="dv-hero">
              <span className="dv-hero-label">Escolha seu clima</span>
              <h1>Sempre tem uma nova história.</h1>
              <p>
                Romance, vingança, suspense e histórias que prendem
                você do primeiro ao último episódio.
              </p>
              <button
                className="dv-primary-button"
                onClick={() => {
                  setSection("Minisséries");
                  setSelectedSeries(null);
                }}
              >
                Explorar minisséries
              </button>
            </section>

            {/* AVISO DE DESENVOLVIMENTO */}
            <div className="dv-development-notice">
              <div className="dv-development-icon">🚧</div>

              <div>
                <h2>DRAMOVIX está em desenvolvimento</h2>

                <p>
                  Estamos preparando tudo para você viver grandes histórias!
                  Nosso catálogo ainda está em construção, e nem todas as
                  minisséries e episódios estão disponíveis neste momento.
                </p>

                <strong>
                  ✨ Novas séries e episódios chegarão em breve!
                </strong>

                <p className="dv-development-thanks">
                  Obrigado por fazer parte do começo dessa jornada. ❤️
                </p>
              </div>
            </div>

            <div className="dv-section-heading">
              <h2>Em destaque</h2>
              <span className="dv-muted">
                {filteredSeries.length} histórias
              </span>
            </div>

            {filteredSeries.length ? (
              <div className="dv-grid">
                {filteredSeries.slice(0, 10).map(renderSeriesCard)}
              </div>
            ) : (
              <div className="dv-empty">
                Nenhuma minissérie encontrada.
              </div>
            )}

            {filteredMovies.length > 0 && (
              <>
                <div className="dv-section-heading">
                  <h2>Filmes</h2>
                </div>
                <div className="dv-grid">
                  {filteredMovies.slice(0, 5).map(renderMovieCard)}
                </div>
              </>
            )}
          </>
        )}

        {!loading && section === "Minisséries" && (
          <>
            {selectedSeries ? (
              <>
                <button
                  className="dv-back-button"
                  onClick={() => setSelectedSeries(null)}
                >
                  ← Voltar ao catálogo
                </button>

                <section className="dv-detail">
                  <img
                    className="dv-detail-cover"
                    src={getSeriesCover(selectedSeries)}
                    alt={selectedSeries.title}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_SERIES_COVER;
                    }}
                  />

                  <div className="dv-detail-content">
                    <span className="dv-card-category">
                      {selectedSeries.category}
                    </span>

                    <h1>{selectedSeries.title}</h1>

                    <p>
                      {selectedSeries.description ||
                        "Prepare-se para acompanhar esta história."}
                    </p>

                    <button
                      className={`dv-favorite-button ${
                        isFavorite(selectedSeries, "series")
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        toggleFavorite(selectedSeries, "series")
                      }
                      title="Favoritos"
                    >
                      {isFavorite(selectedSeries, "series") ? "♥" : "♡"}
                    </button>

                    {(
                      normalizeText(selectedSeries.title).includes(
                        "sireno"
                      ) ||
                      normalizeText(selectedSeries.title).includes(
                        "cortejar"
                      )
                    ) ? (
                      <div style={{ marginTop: 24 }}>
                        <button
                          className="dv-primary-button"
                          onClick={watchSireno}
                          disabled={episodesLoading}
                          style={{
                            width: "100%",
                            maxWidth: 340,
                            padding: "15px 18px",
                            fontSize: 14,
                          }}
                        >
                          {episodesLoading
                            ? "CARREGANDO EPISÓDIO..."
                            : "▶ ASSISTIR MINISSÉRIE"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="dv-section-heading">
                          <h2>Episódios</h2>
                          <span className="dv-muted">
                            {episodes.length} episódios
                          </span>
                        </div>

                        {episodesLoading ? (
                          <div className="dv-empty">
                            Carregando episódios...
                          </div>
                        ) : episodes.length ? (
                          <div className="dv-episode-list">
                            {episodes.map((episode, index) => (
                              <article
                                className="dv-episode"
                                key={episode.id}
                              >
                                <div className="dv-episode-number">
                                  {episode.episode_number ?? index + 1}
                                </div>

                                <div className="dv-episode-info">
                                  <h3>
                                    {normalizeEpisodeTitle(
                                      episode,
                                      index
                                    )}
                                  </h3>
                                  <p>
                                    Episódio{" "}
                                    {episode.episode_number ?? index + 1}
                                  </p>
                                </div>

                                <button
                                  className="dv-primary-button"
                                  onClick={() =>
                                    openEpisode(episode, index)
                                  }
                                >
                                  ▶ Assistir
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="dv-empty">
                            Ainda não há episódios cadastrados para esta
                            minissérie.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <>
                <div className="dv-section-heading">
                  <h2>Minisséries</h2>
                  <span className="dv-muted">
                    {filteredSeries.length} histórias
                  </span>
                </div>

                <div className="dv-categories">
                  {seriesCategories.map((item) => (
                    <button
                      key={item}
                      className={category === item ? "active" : ""}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {filteredSeries.length ? (
                  <div className="dv-grid">
                    {filteredSeries.map(renderSeriesCard)}
                  </div>
                ) : (
                  <div className="dv-empty">
                    Nenhuma minissérie encontrada.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && section === "Filmes" && (
          <>
            <div className="dv-section-heading">
              <h2>Filmes</h2>
              <span className="dv-muted">
                {filteredMovies.length} filmes
              </span>
            </div>

            {filteredMovies.length ? (
              <div className="dv-grid">
                {filteredMovies.map(renderMovieCard)}
              </div>
            ) : (
              <div className="dv-empty">
                Nenhum filme encontrado. Verifique se a tabela movies
                existe no Supabase e se há filmes cadastrados.
              </div>
            )}
          </>
        )}

        {!loading && section === "TV ao vivo" && (
          <>
            <div className="dv-section-heading">
              <h2>TV ao vivo</h2>
              <span className="dv-muted">
                {filteredChannels.length} canais
              </span>
            </div>

            <div className="dv-categories">
              {Object.entries(PLAYLISTS).map(([key, playlist]) => (
                <button
                  key={key}
                  className={channelSource === key ? "active" : ""}
                  onClick={() => setChannelSource(key)}
                >
                  {playlist.name}
                </button>
              ))}
            </div>

            <div className="dv-categories">
              {channelCategories.map((item) => (
                <button
                  key={item}
                  className={
                    channelCategory === item ? "active" : ""
                  }
                  onClick={() => setChannelCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {playlistLoading && (
              <div className="dv-notice">
                Carregando canais da playlist...
              </div>
            )}

            {filteredChannels.length ? (
              <div className="dv-channel-list">
                {filteredChannels.map(renderChannelCard)}
              </div>
            ) : (
              <div className="dv-empty">
                Nenhum canal encontrado nesta lista.
              </div>
            )}
          </>
        )}

        {!loading && section === "Favoritos" && (
          <>
            <div className="dv-section-heading">
              <h2>Meus favoritos</h2>
              <span className="dv-muted">
                {favorites.length} salvos
              </span>
            </div>

            {favoriteSeries.length > 0 && (
              <>
                <div className="dv-section-heading">
                  <h2>Minisséries</h2>
                </div>

                <div className="dv-grid">
                  {favoriteSeries.map((favorite) => {
                    const item =
                      series.find(
                        (entry) =>
                          String(entry.id) === String(favorite.id)
                      ) || favorite.item;

                    return renderSeriesCard(item);
                  })}
                </div>
              </>
            )}

            {favoriteMovies.length > 0 && (
              <>
                <div className="dv-section-heading">
                  <h2>Filmes</h2>
                </div>

                <div className="dv-grid">
                  {favoriteMovies.map((favorite) => {
                    const item =
                      movies.find(
                        (entry) =>
                          String(entry.id) === String(favorite.id)
                      ) || favorite.item;

                    return renderMovieCard(item);
                  })}
                </div>
              </>
            )}

            {favorites.length === 0 && (
              <div className="dv-empty">
                Você ainda não adicionou favoritos. Toque no coração de
                uma minissérie ou filme para salvá-lo.
              </div>
            )}
          </>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX · Sempre tem uma nova história.
      </footer>

      {playerOpen && (
        <div
          className={`dv-player-modal ${
            currentVideo?.type === "episode"
              ? "dv-player-vertical"
              : ""
          }`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePlayer();
            }
          }}
        >
          <div className="dv-player-panel">
            <div className="dv-player-header">
              <h2>
                {currentVideo?.name ||
                  currentVideo?.title ||
                  "DRAMOVIX"}
              </h2>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar vídeo"
              >
                ×
              </button>
            </div>

            {currentVideo?.url ? (
              <div className="dv-video-wrap">
                {isEmbeddedVideoUrl(currentVideo.url) ? (
                  <iframe
                    key={getEmbeddedVideoUrl(currentVideo.url)}
                    src={getEmbeddedVideoUrl(currentVideo.url)}
                    title={
                      currentVideo?.name ||
                      currentVideo?.title ||
                      "Vídeo DRAMOVIX"
                    }
                    className="dv-video"
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      border: 0,
                      background: "#000",
                    }}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="eager"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <video
                    key={currentVideo.url}
                    ref={videoRef}
                    className="dv-video"
                    controls
                    playsInline
                    autoPlay
                    preload="metadata"
                    onEnded={() => {
                      if (currentVideo?.type === "episode") {
                        playNextEpisode();
                      }
                    }}
                    onError={() => {
                      if (!isHlsUrl(currentVideo?.url || "")) {
                        setPlayerError(
                          "Não foi possível reproduzir este vídeo. Verifique se o link está correto e acessível."
                        );
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="dv-empty">
                Este conteúdo ainda não possui um link de vídeo
                cadastrado.
              </div>
            )}

            {playerError && (
              <div className="dv-player-error">{playerError}</div>
            )}

            {currentVideo?.type === "episode" && (
              <div className="dv-player-next">
                <button
                  className="dv-primary-button"
                  onClick={playNextEpisode}
                  disabled={
                    !selectedEpisode ||
                    episodes.findIndex(
                      (episode) =>
                        String(episode.id) ===
                        String(selectedEpisode.id)
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
