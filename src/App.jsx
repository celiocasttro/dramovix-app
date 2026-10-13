import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const CHRIS_TITLE = "Todo Mundo Odeia o Chris";

const CHRIS_COVER =
  "https://svinrjrlrlitipleiccb.supabase.co/storage/v1/object/public/dramovix-videos/Capas/CHRIS%20TEMP4.png";

const ZNATION_URL =
  "https://epg.provider.plex.tv/library/parts/646546f35db8ada4c8edd7e5-67d1be3696c7b08c26c19d64.m3u8?includeAllStreams=1&x-plex-product=Plex+Mediaverse&x-plex-token=MZFkHw1Atc9c9bZLRyWw&auto=0";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=700&q=80";

const DEFAULT_MOVIE_COVER =
  "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=700&q=80";

const CHRIS_EPISODES = [
  {
    id: "chris-s4-ep-1",
    title: "Episódio 1",
    episode_number: 1,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636141/mp4/06a9d3ea52f2ca3c622c0f908ae3464fe7fa47d698f411e856f893710cba423a.mp4?secure=sdPb9xRPETR-6T9mmqr2Uw%3D%3D%2C1791942986",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-2",
    title: "Episódio 2",
    episode_number: 2,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636145/mp4/b9b21e4b0b5266b4a844c298bc32fb9c924f669f20ef07610f9259a5af1ac457.mp4?secure=CDvKQ7hv1N6tmdFbkEml9g%3D%3D%2C1791943214",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-3",
    title: "Episódio 3",
    episode_number: 3,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636150/mp4/4c5e0c2048c576ca59ac07dded31754547f843d641dd7862a97634eb8e2d63c7.mp4?secure=7aitJRF5Vgnzzc-TD1oWhg%3D%3D%2C1791943246",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-4",
    title: "Episódio 4",
    episode_number: 4,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636153/mp4/5d7ae6fa268ffb9ccb458bedc5acbcc0309f1af9895914485d47e461e1731d8e.mp4?secure=_GSKKh1jEoXr7DemqknWOA%3D%3D%2C1791943437",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-5",
    title: "Episódio 5",
    episode_number: 5,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636159/mp4/fe2fbdb7ef8639f7298f3dec41f00ee1a09ce637776604cf1a0438d47d757db5.mp4?secure=ZftfL-apKOQhDjPrbfGTNw%3D%3D%2C1791943176",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-6",
    title: "Episódio 6",
    episode_number: 6,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636165/mp4/a5ed57a34ec54a7269882c14535e86e973ac92850485e043cd2055ff8577f5aa.mp4?secure=UIXa7VIcdnHN0UpS80OeGw%3D%3D%2C1791942256",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-7",
    title: "Episódio 7",
    episode_number: 7,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636168/mp4/7d81e095149366190fa688f85520c6831aa5748b67bcdecd221f5d78cdbad6a4.mp4?secure=M8wtHs8pWTDC_Wvsi-TMPg%3D%3D%2C1791943510",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-8",
    title: "Episódio 8",
    episode_number: 8,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636171/mp4/e50ea655d2e94fd095048a07369a5ad3dbb64dacee08b45822f08a6a37b88f06.mp4?secure=XpSSswVxeexkmptszHWMAQ%3D%3D%2C1791943533",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-9",
    title: "Episódio 9",
    episode_number: 9,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636175/mp4/79de605fcf1f3768eeece43490ca5767a495412659697c99aae7b4fe38ba8ddd.mp4?secure=Iiz3TA9tU4bebNN0e3liew%3D%3D%2C1791942623",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-10",
    title: "Episódio 10",
    episode_number: 10,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636178/mp4/fc1dbff31eaa2120c1ba379a2923c08c45b985fc2b2a5e4ac23a0b7e9ef6e266.mp4?secure=mWxrkFerGzeXEbbaQ0REOA%3D%3D%2C1791943661",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-11",
    title: "Episódio 11",
    episode_number: 11,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636184/mp4/79a40db9a7239fa8cfc23b3d2a09caf8aca9f738410b615c42b83becd12900ea.mp4?secure=rQdwvb6NJF0jL2ivyqam6w%3D%3D%2C1791943679",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-12",
    title: "Episódio 12",
    episode_number: 12,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636192/mp4/045e4f79ee0b664bd0053646ada353d9c07b78db3ae21ef3d71719374175f969.mp4?secure=VYJTkds8ce3jJldEAF5bCg%3D%3D%2C1791943277",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-13",
    title: "Episódio 13",
    episode_number: 13,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636194/mp4/a01c22e56a786b95b0574891b92c0291f23fee2b5f143fc49cba8dd884b0d432.mp4?secure=qX8BF8D_o4LAKWA8WvjW5g%3D%3D%2C1791943738",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-14",
    title: "Episódio 14",
    episode_number: 14,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636196/mp4/b78f787c4ac1437ed84949db08bb7028a038da5a4e6ff22238f437250091e2df.mp4?secure=AlTiO8u_XO-Qe7fi2BecGg%3D%3D%2C1791943145",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-15",
    title: "Episódio 15",
    episode_number: 15,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636201/mp4/1c72672a81e4daea6bb305b69f46626409be7e6c98d4840689ab8828bfad3c83.mp4?secure=pSHlnMaEKqOTqpF6Bacyhw%3D%3D%2C1791943791",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-16",
    title: "Episódio 16",
    episode_number: 16,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636206/mp4/2ab2134c0209d14474fabb53cd1cb1332b788bde9be6c21c18e69cb9f435590d.mp4?secure=kJjPqsHVKBqWkYR2m8QXfg%3D%3D%2C1791943817",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-17",
    title: "Episódio 17",
    episode_number: 17,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636209/mp4/81e667d6089a76953909190c9785f89206adc120ca3738a3b15be1e04a895e13.mp4?secure=aqLK1CACDarZdP7ytawsmw%3D%3D%2C1791942855",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-18",
    title: "Episódio 18",
    episode_number: 18,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636216/mp4/e577caca3f2efa7b446de3636c6f03efac1fd38b6cdf958d0a329d26b4f234cd.mp4?secure=z9L5yBzsEcTFD2yg4wo49g%3D%3D%2C1791943855",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-19",
    title: "Episódio 19",
    episode_number: 19,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636222/mp4/dae74a16de2a9183d5abe572c4fae03ee52645483a383d6d5156701154f798c9.mp4?secure=rRr9vwaieuwqXdHe1qi8zQ%3D%3D%2C1791943891",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-20",
    title: "Episódio 20",
    episode_number: 20,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636225/mp4/04a8a190e3ba693171baee4b732c18137dad6c800a1be8f76b26533c21095b35.mp4?secure=KNMb_FmsYuJIeJgEXbpGHQ%3D%3D%2C1791943910",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-21",
    title: "Episódio 21",
    episode_number: 21,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636229/mp4/61a3a063993f2a55acec54eea140f4dae57b3d4d726469f3de4d36ac39399d3f.mp4?secure=60MemR67F9Mkh3hFPV6z-A%3D%3D%2C1791943927",
    isChrisEpisode: true,
  },
  {
    id: "chris-s4-ep-22",
    title: "Episódio 22",
    episode_number: 22,
    season_number: 4,
    video_url:
      "https://cdnst70.tokyvideo.com/videos/636/636230/mp4/d5412af27357ef2595289cdae6cbc9ef3e204cb90bc3dd8960d73889972fa7d1.mp4?secure=cMijEbbfxvHhVG4RbLo8GQ%3D%3D%2C1791943519",
    isChrisEpisode: true,
  },
];

const CHRIS_SERIES = {
  id: "chris-series",
  title: CHRIS_TITLE,
  category: "Comédia",
  description:
    "Acompanhe as aventuras e confusões de Chris e sua família.",
  image: CHRIS_COVER,
  isChris: true,
  episodes: CHRIS_EPISODES,
};

const LIVE_SERIES = {
  id: "live-znation",
  title: "Z Nation",
  category: "Ao vivo",
  description: "Assista à transmissão de Z Nation.",
  image: DEFAULT_COVER,
  video_url: ZNATION_URL,
  isLive: true,
};

const normalize = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function App() {
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [page, setPage] = useState("inicio");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dramovix-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("dramovix-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);

      try {
        const [seriesResult, moviesResult] = await Promise.all([
          supabase
            .from("series")
            .select("*")
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("movies")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (seriesResult.error) {
          console.error("Erro ao carregar séries:", seriesResult.error);
        }

        if (moviesResult.error) {
          console.error("Erro ao carregar filmes:", moviesResult.error);
        }

        const loadedSeries = (seriesResult.data || []).map((item) => ({
          id: `db-${item.id}`,
          dbId: item.id,
          title: item.title || "Sem título",
          category: item.genre || "Romance",
          description: item.description || "",
          image: item.cover_url || DEFAULT_COVER,
          isChris: normalize(item.title) === normalize(CHRIS_TITLE),
          isLive: false,
        }));

        const hasChris = loadedSeries.some((item) => item.isChris);

        if (!hasChris) {
          loadedSeries.push(CHRIS_SERIES);
        }

        const loadedMovies = (moviesResult.data || []).map((item) => ({
          id: `movie-${item.id}`,
          dbId: item.id,
          title: item.title || "Sem título",
          category: item.genre || "Filme",
          description: item.description || "",
          image: item.cover_url || DEFAULT_MOVIE_COVER,
          video_url: item.video_url || "",
        }));

        if (!cancelled) {
          setSeries(loadedSeries);
          setMovies(loadedMovies);
        }
      } catch (error) {
        console.error("Erro ao carregar catálogo:", error);

        if (!cancelled) {
          setSeries([CHRIS_SERIES]);
          setMovies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSeries) {
      setEpisodes([]);
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);

      try {
        if (selectedSeries.isChris) {
          if (!cancelled) setEpisodes(CHRIS_EPISODES);
          return;
        }

        if (!selectedSeries.dbId) {
          if (!cancelled) setEpisodes([]);
          return;
        }

        const { data, error } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", selectedSeries.dbId)
          .order("episode_number", { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setEpisodes(
            (data || []).map((episode) => ({
              ...episode,
              title:
                episode.title ||
                `Episódio ${episode.episode_number || ""}`.trim(),
              video_url: episode.video_url || "",
            }))
          );
        }
      } catch (error) {
        console.error("Erro ao carregar episódios:", error);

        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setEpisodesLoading(false);
      }
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeries]);

  // PLAYER CORRIGIDO: reproduz MP4 diretamente e HLS com hls.js.
  useEffect(() => {
    if (!playerOpen || !selectedEpisode || !videoRef.current) return;

    const video = videoRef.current;
    const url = selectedEpisode.video_url || "";
    let hls = null;
    let cancelled = false;

    setPlayerError("");

    if (!url) {
      setPlayerError("Este episódio ainda não possui um link de vídeo.");
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    const isHls = /\.m3u8(?:$|\?)/i.test(url);

    const handleVideoError = () => {
      if (cancelled) return;

      const mediaError = video.error;

      if (mediaError) {
        console.error("Erro do elemento de vídeo:", {
          code: mediaError.code,
          message: mediaError.message,
          url,
        });
      }

      setPlayerError(
        "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução."
      );
    };

    video.addEventListener("error", handleVideoError);

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!cancelled) {
          hls.loadSource(url);
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          video.play().catch((error) => {
            console.warn("Reprodução automática bloqueada:", error);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;

        console.error("Erro fatal do HLS:", data);

        setPlayerError(
          "Não foi possível carregar a transmissão. O link pode ter expirado ou o servidor pode bloquear a reprodução."
        );
      });

      hls.attachMedia(video);
    } else if (
      isHls &&
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = url;
      video.load();

      video.play().catch((error) => {
        console.warn("Reprodução automática bloqueada:", error);
      });
    } else if (!isHls) {
      // O link do episódio 1 do Chris é um arquivo MP4 direto.
      video.src = url;
      video.load();

      video.play().catch((error) => {
        // O usuário ainda pode iniciar a reprodução pelo botão do player.
        console.warn("Reprodução automática bloqueada:", error);
      });
    } else {
      setPlayerError(
        "Este navegador não conseguiu reproduzir o formato de vídeo."
      );
    }

    return () => {
      cancelled = true;

      video.removeEventListener("error", handleVideoError);

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
  }, [playerOpen, selectedEpisode]);

  const allSeries = [...series, LIVE_SERIES];

  const categories = [
    "Todas",
    ...new Set(
      allSeries
        .filter((item) => !item.isLive)
        .map((item) => item.category)
        .filter(Boolean)
    ),
  ];

  const filteredSeries = series.filter((item) => {
    const matchesSearch =
      normalize(item.title).includes(normalize(search)) ||
      normalize(item.description).includes(normalize(search));

    const matchesCategory =
      category === "Todas" || item.category === category;

    return matchesSearch && matchesCategory;
  });

  const filteredMovies = movies.filter((item) =>
    normalize(item.title).includes(normalize(search))
  );

  function toggleFavorite(item) {
    setFavorites((previous) =>
      previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id]
    );
  }

  function isFavorite(item) {
    return favorites.includes(item.id);
  }

  function openSeries(item) {
    setSelectedSeries(item);
    setSelectedEpisode(null);
    setShowDescription(false);
    setPage("detalhes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openPlayer(episode) {
    if (!episode?.video_url) {
      setPlayerError("Este vídeo não possui um link configurado.");
      setSelectedEpisode(episode);
      setPlayerOpen(true);
      return;
    }

    setSelectedEpisode(episode);
    setPlayerError("");
    setPlayerOpen(true);
  }

  function openEpisode(episode) {
    openPlayer(episode);
  }

  function openLive(item) {
    setSelectedSeries(item);
    setSelectedEpisode({
      id: `${item.id}-stream`,
      title: item.title,
      video_url: item.video_url,
      isLive: true,
    });
    setPlayerError("");
    setPlayerOpen(true);
  }

  function closePlayer() {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    setPlayerOpen(false);
    setSelectedEpisode(null);
    setPlayerError("");
  }

  function playNextEpisode() {
    if (!selectedEpisode || !episodes.length) return;

    const currentIndex = episodes.findIndex(
      (episode) => episode.id === selectedEpisode.id
    );

    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      openPlayer(episodes[currentIndex + 1]);
    }
  }

  function handleVideoEnded() {
    if (selectedEpisode?.isLive) return;
    playNextEpisode();
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setSearch("");
    setCategory("Todas");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCard(item, type = "series") {
    const favorite = isFavorite(item);

    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={() => {
            if (type === "live") {
              openLive(item);
            } else if (type === "movie") {
              openPlayer({
                id: item.id,
                title: item.title,
                video_url: item.video_url,
              });
            } else {
              openSeries(item);
            }
          }}
          aria-label={`Abrir ${item.title}`}
        >
          <img
            className="dv-card-image"
            src={item.image || DEFAULT_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_COVER;
            }}
          />

          <span className="dv-card-play">▶</span>

          {type === "live" && (
            <span className="dv-live-badge">AO VIVO</span>
          )}
        </button>

        <div className="dv-card-content">
          <span className="dv-card-category">
            {type === "live" ? "AO VIVO" : item.category}
          </span>

          <h3>{item.title}</h3>

          <p>{item.description || "Uma nova história espera por você."}</p>

          <div className="dv-card-actions">
            <button
              className="dv-button-primary"
              onClick={() => {
                if (type === "live") {
                  openLive(item);
                } else if (type === "movie") {
                  openPlayer({
                    id: item.id,
                    title: item.title,
                    video_url: item.video_url,
                  });
                } else {
                  openSeries(item);
                }
              }}
            >
              ▶ {type === "live" ? "Assistir" : "Ver detalhes"}
            </button>

            {type !== "live" && (
              <button
                className={`dv-favorite-button ${
                  favorite ? "active" : ""
                }`}
                onClick={() => toggleFavorite(item)}
                aria-label={
                  favorite
                    ? "Remover dos favoritos"
                    : "Adicionar aos favoritos"
                }
              >
                {favorite ? "♥" : "♡"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  function renderGrid(items, type = "series") {
    if (loading && type !== "live") {
      return <p className="dv-message">Carregando catálogo...</p>;
    }

    if (!items.length) {
      return (
        <div className="dv-empty">
          <span>✦</span>
          <h3>Nada por aqui ainda</h3>
          <p>Experimente outra categoria ou faça uma nova busca.</p>
        </div>
      );
    }

    return (
      <div className="dv-grid">
        {items.map((item) => renderCard(item, type))}
      </div>
    );
  }

  const favoriteSeries = series.filter((item) => isFavorite(item));
  const favoriteMovies = movies.filter((item) => isFavorite(item));

  return (
    <div className="dv-app">
      <style>{`
        :root {
          color-scheme: dark;
          --dv-bg: #08090e;
          --dv-panel: #11131b;
          --dv-panel-2: #191c27;
          --dv-text: #f7f7fb;
          --dv-muted: #9b9dad;
          --dv-accent: #a855f7;
          --dv-accent-2: #ec4899;
          --dv-border: rgba(255,255,255,.09);
        }

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: var(--dv-bg);
          color: var(--dv-text);
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        button, input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .dv-app {
          min-height: 100vh;
          background:
            radial-gradient(ellipse at top left, rgba(124,58,237,.11), transparent 38%),
            var(--dv-bg);
          color: var(--dv-text);
        }

        .dv-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 15px clamp(16px, 5vw, 76px);
          background: rgba(8,9,14,.94);
          border-bottom: 1px solid var(--dv-border);
          backdrop-filter: blur(18px);
        }

        .dv-logo {
          border: 0;
          background: transparent;
          color: white;
          font-size: 25px;
          font-weight: 950;
          letter-spacing: -1.3px;
          white-space: nowrap;
        }

        .dv-logo span {
          color: var(--dv-accent);
        }

        .dv-search {
          display: flex;
          align-items: center;
          width: min(350px, 35vw);
          padding: 0 14px;
          border: 1px solid var(--dv-border);
          border-radius: 999px;
          background: #141620;
        }

        .dv-search span {
          color: var(--dv-muted);
        }

        .dv-search input {
          width: 100%;
          padding: 11px;
          border: 0;
          outline: none;
          color: white;
          background: transparent;
        }

        .dv-nav {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 13px 16px;
          border-bottom: 1px solid var(--dv-border);
        }

        .dv-nav button {
          padding: 9px 15px;
          color: #c5c6d1;
          border: 1px solid transparent;
          border-radius: 999px;
          background: transparent;
          transition: .2s;
        }

        .dv-nav button:hover,
        .dv-nav button.active {
          color: white;
          border-color: rgba(168,85,247,.35);
          background: rgba(168,85,247,.14);
        }

        .dv-main {
          width: min(1450px, 100%);
          min-height: 70vh;
          margin: auto;
          padding: 26px clamp(16px, 5vw, 76px) 70px;
        }

        .dv-hero {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 290px;
          overflow: hidden;
          margin: 8px 0 34px;
          padding: clamp(25px, 5vw, 58px);
          border: 1px solid rgba(168,85,247,.2);
          border-radius: 26px;
          background:
            radial-gradient(ellipse at 80% 15%, rgba(236,72,153,.35), transparent 35%),
            radial-gradient(ellipse at 65% 100%, rgba(124,58,237,.36), transparent 48%),
            linear-gradient(120deg, #181321, #10121b 72%);
        }

        .dv-hero-content {
          position: relative;
          z-index: 1;
          max-width: 650px;
        }

        .dv-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #d8b4fe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .dv-hero h1 {
          margin: 15px 0;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 1.04;
          letter-spacing: -2px;
        }

        .dv-hero p {
          max-width: 500px;
          color: #c0c1cf;
          line-height: 1.7;
        }

        .dv-button-primary {
          padding: 11px 17px;
          color: white;
          font-weight: 800;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(110deg, #9333ea, #db2777);
          transition: transform .2s, filter .2s;
        }

        .dv-button-primary:hover {
          transform: translateY(-2px);
          filter: brightness(1.12);
        }

        .dv-section {
          margin: 32px 0 40px;
        }

        .dv-section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 19px;
        }

        .dv-section-heading h2 {
          margin: 0;
          font-size: clamp(21px, 3vw, 29px);
          letter-spacing: -.6px;
        }

        .dv-section-heading p {
          margin: 7px 0 0;
          color: var(--dv-muted);
          font-size: 14px;
        }

        .dv-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 17px 0 30px;
        }

        .dv-category-button {
          padding: 10px 16px;
          color: #d1d2df;
          border: 1px solid var(--dv-border);
          border-radius: 999px;
          background: var(--dv-panel);
        }

        .dv-category-button:hover,
        .dv-category-button.active {
          color: white;
          border-color: var(--dv-accent);
          background: rgba(168,85,247,.17);
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 19px;
        }

        .dv-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--dv-border);
          border-radius: 17px;
          background: var(--dv-panel);
          transition: transform .22s, border-color .22s;
        }

        .dv-card:hover {
          transform: translateY(-4px);
          border-color: rgba(168,85,247,.45);
        }

        .dv-card-image-button {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          padding: 0;
          border: 0;
          background: #20212b;
        }

        .dv-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .3s;
        }

        .dv-card:hover .dv-card-image {
          transform: scale(1.04);
        }

        .dv-card-play {
          position: absolute;
          right: 13px;
          bottom: 13px;
          display: grid;
          width: 43px;
          height: 43px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 50%;
          background: rgba(168,85,247,.9);
          color: white;
        }

        .dv-live-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 6px 9px;
          border-radius: 6px;
          color: white;
          background: #dc2626;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .dv-card-content {
          padding: 15px;
        }

        .dv-card-category {
          color: #c084fc;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }

        .dv-card h3 {
          margin: 8px 0;
          font-size: 16px;
          line-height: 1.4;
        }

        .dv-card p {
          display: -webkit-box;
          overflow: hidden;
          min-height: 40px;
          margin: 0 0 15px;
          color: var(--dv-muted);
          font-size: 12px;
          line-height: 1.6;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .dv-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dv-card-actions .dv-button-primary {
          flex: 1;
          padding: 10px 8px;
          font-size: 12px;
        }

        .dv-favorite-button {
          display: grid;
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid var(--dv-border);
          border-radius: 10px;
          background: var(--dv-panel-2);
          color: white;
          font-size: 20px;
        }

        .dv-favorite-button.active {
          color: #fb7185;
          border-color: rgba(251,113,133,.4);
        }

        .dv-empty,
        .dv-message {
          padding: 40px 15px;
          text-align: center;
          color: var(--dv-muted);
        }

        .dv-empty span {
          color: #c084fc;
          font-size: 35px;
        }

        .dv-empty h3 {
          color: white;
        }

        .dv-detail {
          max-width: 1050px;
          margin: 15px auto;
        }

        .dv-back {
          margin-bottom: 20px;
          padding: 9px 0;
          color: #d8b4fe;
          border: 0;
          background: transparent;
        }

        .dv-detail-header {
          display: grid;
          grid-template-columns: minmax(190px, 280px) minmax(0, 1fr);
          gap: 30px;
          align-items: start;
          padding: 22px;
          border: 1px solid var(--dv-border);
          border-radius: 20px;
          background: var(--dv-panel);
        }

        .dv-detail-cover {
          display: block;
          width: 100%;
          max-height: 390px;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          border-radius: 13px;
          background: var(--dv-panel-2);
        }

        .dv-detail-info {
          min-width: 0;
        }

        .dv-detail-info h1 {
          margin: 9px 0 15px;
          font-size: clamp(25px, 4vw, 38px);
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .dv-detail-info p {
          color: #b8bac9;
          line-height: 1.8;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .dv-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .dv-description-toggle {
          padding: 10px 14px;
          color: white;
          border: 1px solid var(--dv-border);
          border-radius: 10px;
          background: var(--dv-panel-2);
        }

        .dv-episodes {
          min-width: 0;
          margin-top: 28px;
        }

        .dv-episodes h2 {
          margin-bottom: 16px;
        }

        .dv-episode-list {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          min-width: 0;
          padding: 13px;
          text-align: left;
          color: white;
          border: 1px solid var(--dv-border);
          border-radius: 13px;
          background: var(--dv-panel);
          transition: border-color .2s, background .2s;
        }

        .dv-episode:hover {
          border-color: var(--dv-accent);
          background: #191522;
        }

        .dv-episode-number {
          display: grid;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 10px;
          background: rgba(168,85,247,.15);
          color: #d8b4fe;
          font-weight: 900;
        }

        .dv-episode-info {
          flex: 1;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .dv-episode-info strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .dv-episode-info small {
          display: block;
          margin-top: 5px;
          color: var(--dv-muted);
        }

        .dv-episode-play {
          flex-shrink: 0;
          color: #d8b4fe;
          font-size: 20px;
        }

        .dv-player-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          padding: 16px;
          background: rgba(0,0,0,.92);
          backdrop-filter: blur(12px);
        }

        .dv-player-modal {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(100%, 480px);
          max-height: calc(100dvh - 32px);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 18px;
          background: #0d0e14;
          box-shadow: 0 25px 90px rgba(0,0,0,.55);
        }

        .dv-player-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 15px;
          border-bottom: 1px solid var(--dv-border);
        }

        .dv-player-heading {
          min-width: 0;
        }

        .dv-player-heading strong {
          display: block;
          overflow: hidden;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-player-heading small {
          display: block;
          margin-top: 4px;
          color: var(--dv-muted);
        }

        .dv-player-close {
          display: grid;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          place-items: center;
          color: white;
          border: 1px solid var(--dv-border);
          border-radius: 50%;
          background: #20212b;
          font-size: 22px;
        }

        .dv-video-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-height: calc(100dvh - 125px);
          aspect-ratio: 9 / 16;
          overflow: hidden;
          background: #000;
        }

        .dv-video {
          display: block;
          width: 100%;
          height: 100%;
          max-height: calc(100dvh - 125px);
          aspect-ratio: 9 / 16;
          object-fit: contain;
          background: #000;
        }

        .dv-player-error {
          padding: 18px;
          color: #fecaca;
          text-align: center;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .dv-player-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px;
          border-top: 1px solid var(--dv-border);
        }

        .dv-player-bottom span {
          overflow: hidden;
          color: var(--dv-muted);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-player-next {
          padding: 10px 13px;
          color: white;
          border: 0;
          border-radius: 9px;
          background: #7c3aed;
          font-size: 12px;
          font-weight: 800;
        }

        .dv-player-next:disabled {
          cursor: not-allowed;
          opacity: .45;
        }

        .dv-footer {
          padding: 25px 16px;
          border-top: 1px solid var(--dv-border);
          color: var(--dv-muted);
          text-align: center;
          font-size: 12px;
        }

        @media (min-width: 1500px) {
          .dv-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }

        @media (max-width: 1050px) {
          .dv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .dv-header {
            padding-inline: 22px;
          }

          .dv-main {
            padding-inline: 22px;
          }
        }

        @media (max-width: 760px) {
          .dv-header {
            flex-wrap: wrap;
            gap: 12px;
            padding: 13px 16px;
          }

          .dv-logo {
            font-size: 22px;
          }

          .dv-search {
            order: 3;
            width: 100%;
          }

          .dv-nav {
            justify-content: flex-start;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding: 10px 12px;
          }

          .dv-nav button {
            flex-shrink: 0;
            font-size: 12px;
          }

          .dv-main {
            padding: 18px 15px 50px;
          }

          .dv-hero {
            min-height: 255px;
            margin-top: 3px;
            border-radius: 18px;
          }

          .dv-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .dv-card {
            border-radius: 13px;
          }

          .dv-card-content {
            padding: 11px;
          }

          .dv-card h3 {
            font-size: 14px;
          }

          .dv-card p {
            font-size: 11px;
          }

          .dv-card-actions .dv-button-primary {
            font-size: 11px;
          }

          .dv-detail-header {
            grid-template-columns: 1fr;
            gap: 18px;
            padding: 15px;
          }

          .dv-detail-cover {
            width: min(100%, 260px);
            margin: 0 auto;
          }

          .dv-detail-info h1 {
            font-size: 27px;
          }

          .dv-episode {
            gap: 10px;
            padding: 10px;
          }

          .dv-player-overlay {
            padding: 0;
          }

          .dv-player-modal {
            width: 100%;
            max-height: 100dvh;
            border-radius: 0;
            border: 0;
          }

          .dv-video-wrap {
            max-height: calc(100dvh - 125px);
          }

          .dv-video {
            max-height: calc(100dvh - 125px);
          }
        }

        @media (max-width: 520px) {
          .dv-grid {
            gap: 10px;
          }

          .dv-card-play {
            width: 35px;
            height: 35px;
            right: 9px;
            bottom: 9px;
          }

          .dv-card-category {
            font-size: 9px;
          }

          .dv-card h3 {
            font-size: 13px;
          }

          .dv-card-actions {
            gap: 5px;
          }

          .dv-favorite-button {
            width: 34px;
            height: 36px;
          }

          .dv-section-heading h2 {
            font-size: 22px;
          }

          .dv-episode-number {
            width: 38px;
            height: 38px;
          }
        }
      `}</style>

      <header className="dv-header">
        <button
          className="dv-logo"
          onClick={() => goToPage("inicio")}
          aria-label="DRAMOVIX início"
        >
          DRAMOVIX<span>+</span>
        </button>

        <label className="dv-search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Buscar histórias..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (page === "inicio") setPage("minisseries");
            }}
          />
        </label>
      </header>

      <nav className="dv-nav">
        {[
          ["inicio", "Início"],
          ["minisseries", "Minisséries"],
          ["filmes", "Filmes"],
          ["ao-vivo", "Ao vivo"],
          ["favoritos", `♥ Favoritos (${favorites.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            className={page === key ? "active" : ""}
            onClick={() => goToPage(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="dv-main">
        {page === "detalhes" && selectedSeries && (
          <section className="dv-detail">
            <button
              className="dv-back"
              onClick={() => goToPage("minisseries")}
            >
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail-header">
              <img
                className="dv-detail-cover"
                src={selectedSeries.image || DEFAULT_COVER}
                alt={selectedSeries.title}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_COVER;
                }}
              />

              <div className="dv-detail-info">
                <span className="dv-eyebrow">
                  {selectedSeries.category || "MINISSÉRIE"}
                </span>

                <h1>{selectedSeries.title}</h1>

                <p>
                  {showDescription
                    ? selectedSeries.description || "Descrição indisponível."
                    : (selectedSeries.description ||
                        "Uma nova história espera por você.")
                        .slice(0, 180) +
                      ((selectedSeries.description || "").length > 180
                        ? "..."
                        : "")}
                </p>

                {(selectedSeries.description || "").length > 180 && (
                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      setShowDescription((value) => !value)
                    }
                  >
                    {showDescription
                      ? "Mostrar menos"
                      : "Ler descrição completa"}
                  </button>
                )}

                <div className="dv-detail-actions">
                  <button
                    className="dv-button-primary"
                    onClick={() => {
                      if (episodes.length) openEpisode(episodes[0]);
                    }}
                    disabled={episodesLoading || !episodes.length}
                  >
                    ▶ Assistir primeiro episódio
                  </button>

                  <button
                    className={`dv-description-toggle ${
                      isFavorite(selectedSeries) ? "active" : ""
                    }`}
                    onClick={() => toggleFavorite(selectedSeries)}
                  >
                    {isFavorite(selectedSeries)
                      ? "♥ Nos favoritos"
                      : "♡ Adicionar aos favoritos"}
                  </button>
                </div>
              </div>
            </div>

            <section className="dv-episodes">
              <div className="dv-section-heading">
                <div>
                  <h2>Episódios</h2>
                  <p>
                    {episodes.length} episódio
                    {episodes.length === 1 ? "" : "s"} disponível
                    {episodes.length === 1 ? "" : "is"}
                  </p>
                </div>
              </div>

              {episodesLoading ? (
                <p className="dv-message">Carregando episódios...</p>
              ) : episodes.length ? (
                <div className="dv-episode-list">
                  {episodes.map((episode, index) => (
                    <button
                      className="dv-episode"
                      key={episode.id || index}
                      onClick={() => openEpisode(episode)}
                    >
                      <span className="dv-episode-number">
                        {episode.episode_number || index + 1}
                      </span>

                      <span className="dv-episode-info">
                        <strong>
                          {episode.title || `Episódio ${index + 1}`}
                        </strong>

                        <small>
                          {episode.video_url
                            ? "▶ Pronto para assistir"
                            : "Link ainda não configurado"}
                        </small>
                      </span>

                      <span className="dv-episode-play">▶</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dv-empty">
                  <h3>Nenhum episódio cadastrado</h3>
                  <p>
                    Os episódios desta série ainda não estão disponíveis.
                  </p>
                </div>
              )}
            </section>
          </section>
        )}

        {page === "inicio" && (
          <>
            <section className="dv-hero">
              <div className="dv-hero-content">
                <span className="dv-eyebrow">
                  ✦ DRAMOVIX+ ORIGINAL
                </span>

                <h1>Sempre tem uma nova história.</h1>

                <p>
                  Romance, vingança, suspense e histórias que prendem você
                  do primeiro ao último episódio.
                </p>

                <button
                  className="dv-button-primary"
                  onClick={() => goToPage("minisseries")}
                >
                  Explorar catálogo →
                </button>
              </div>
            </section>

            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Escolha seu clima</h2>
                  <p>Histórias para cada momento.</p>
                </div>
              </div>

              <div className="dv-categories">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={`dv-category-button ${
                      category === item ? "active" : ""
                    }`}
                    onClick={() => {
                      setCategory(item);
                      setPage("minisseries");
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Em destaque</h2>
                  <p>Descubra sua próxima história favorita.</p>
                </div>
              </div>

              {renderGrid(filteredSeries.slice(0, 8))}
            </section>

            {movies.length > 0 && (
              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Filmes para você</h2>
                    <p>Escolha e comece a assistir.</p>
                  </div>
                </div>

                {renderGrid(filteredMovies.slice(0, 4), "movie")}
              </section>
            )}
          </>
        )}

        {page === "minisseries" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Minisséries</h2>
                <p>Encontre sua próxima maratona.</p>
              </div>
            </div>

            <div className="dv-categories">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`dv-category-button ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {renderGrid(filteredSeries)}
          </section>
        )}

        {page === "filmes" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Filmes</h2>
                <p>Seus filmes disponíveis no catálogo.</p>
              </div>
            </div>

            {renderGrid(filteredMovies, "movie")}
          </section>
        )}

        {page === "ao-vivo" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Ao vivo</h2>
                <p>Transmissões disponíveis.</p>
              </div>
            </div>

            {renderGrid([LIVE_SERIES], "live")}
          </section>
        )}

        {page === "favoritos" && (
          <>
            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Meus favoritos</h2>
                  <p>Suas histórias salvas neste dispositivo.</p>
                </div>
              </div>

              {renderGrid(favoriteSeries)}
            </section>

            {favoriteMovies.length > 0 && (
              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Filmes favoritos</h2>
                  </div>
                </div>

                {renderGrid(favoriteMovies, "movie")}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX+ · Sempre tem uma nova história.
      </footer>

      {playerOpen && (
        <div
          className="dv-player-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePlayer();
          }}
        >
          <div
            className="dv-player-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Player de vídeo"
          >
            <div className="dv-player-top">
              <div className="dv-player-heading">
                <strong>
                  {selectedEpisode?.title ||
                    selectedSeries?.title ||
                    "Reproduzindo"}
                </strong>

                <small>
                  {selectedEpisode?.isLive
                    ? "Transmissão ao vivo"
                    : selectedSeries?.title || "DRAMOVIX+"}
                </small>
              </div>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar player"
              >
                ×
              </button>
            </div>

            <div className="dv-video-wrap">
              <video
                key={selectedEpisode?.id || "dramovix-video"}
                ref={videoRef}
                className="dv-video"
                controls
                playsInline
                preload="metadata"
                onEnded={handleVideoEnded}
              />
            </div>

            {playerError && (
              <div className="dv-player-error" role="alert">
                {playerError}
              </div>
            )}

            <div className="dv-player-bottom">
              <span>
                {selectedEpisode?.isLive
                  ? "Transmissão ao vivo"
                  : selectedEpisode?.episode_number
                    ? `Episódio ${selectedEpisode.episode_number} · Temporada ${
                        selectedEpisode.season_number || 4
                      }`
                    : "DRAMOVIX+"}
              </span>

              {!selectedEpisode?.isLive && (
                <button
                  className="dv-player-next"
                  onClick={playNextEpisode}
                  disabled={
                    !episodes.length ||
                    episodes.findIndex(
                      (episode) => episode.id === selectedEpisode?.id
                    ) >=
                      episodes.length - 1
                  }
                >
                  Próximo episódio →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
