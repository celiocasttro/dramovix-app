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
      return JSON.parse(
        localStorage.getItem("dramovix-favorites") || "[]"
      );
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
    localStorage.setItem(
      "dramovix-favorites",
      JSON.stringify(favorites)
    );
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
          console.error(
            "Erro ao carregar séries:",
            seriesResult.error
          );
        }

        if (moviesResult.error) {
          console.error(
            "Erro ao carregar filmes:",
            moviesResult.error
          );
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
        if (!cancelled) {
          setLoading(false);
        }
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
          if (!cancelled) {
            setEpisodes(CHRIS_EPISODES);
          }
          return;
        }

        if (!selectedSeries.dbId) {
          if (!cancelled) {
            setEpisodes([]);
          }
          return;
        }

        const { data, error } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", selectedSeries.dbId)
          .order("episode_number", { ascending: true });

        if (error) {
          throw error;
        }

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

        if (!cancelled) {
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) {
          setEpisodesLoading(false);
        }
      }
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeries]);

  /*
   * PLAYER:
   * - Reproduz arquivos MP4.
   * - Reproduz transmissões HLS (.m3u8).
   * - Respeita a proporção original do vídeo.
   * - Limpa a reprodução quando o player é fechado ou o episódio muda.
   */
  useEffect(() => {
    if (!playerOpen || !selectedEpisode || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const url = selectedEpisode.video_url || "";

    let hls = null;
    let cancelled = false;

    setPlayerError("");

    if (!url) {
      setPlayerError(
        "Este episódio ainda não possui um link de vídeo."
      );
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
      if (cancelled) {
        return;
      }

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

    const handleMetadata = () => {
      if (cancelled) {
        return;
      }

      /*
       * O navegador identifica a largura e a altura reais do vídeo.
       * A proporção é preservada pelo CSS, sem forçar 9:16 ou 16:9.
       */
      console.log("Dimensões do vídeo:", {
        largura: video.videoWidth,
        altura: video.videoHeight,
        orientacao:
          video.videoWidth > video.videoHeight
            ? "horizontal"
            : video.videoWidth < video.videoHeight
              ? "vertical"
              : "quadrado",
      });
    };

    video.addEventListener("error", handleVideoError);
    video.addEventListener("loadedmetadata", handleMetadata);

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
            console.warn(
              "Reprodução automática bloqueada:",
              error
            );
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) {
          return;
        }

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
        console.warn(
          "Reprodução automática bloqueada:",
          error
        );
      });
    } else if (!isHls) {
      video.src = url;
      video.load();

      video.play().catch((error) => {
        console.warn(
          "Reprodução automática bloqueada:",
          error
        );
      });
    } else {
      setPlayerError(
        "Este navegador não conseguiu reproduzir o formato de vídeo."
      );
    }

    return () => {
      cancelled = true;

      video.removeEventListener("error", handleVideoError);
      video.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );

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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openPlayer(episode) {
    if (!episode?.video_url) {
      setPlayerError(
        "Este vídeo não possui um link configurado."
      );

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
    if (!selectedEpisode || !episodes.length) {
      return;
    }

    const currentIndex = episodes.findIndex(
      (episode) => episode.id === selectedEpisode.id
    );

    if (
      currentIndex >= 0 &&
      currentIndex < episodes.length - 1
    ) {
      openPlayer(episodes[currentIndex + 1]);
    }
  }

  function handleVideoEnded() {
    if (selectedEpisode?.isLive) {
      return;
    }

    playNextEpisode();
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setSearch("");
    setCategory("Todas");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

          <p>
            {item.description ||
              "Uma nova história espera por você."}
          </p>

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
      return (
        <p className="dv-message">
          Carregando catálogo...
        </p>
      );
    }

    if (!items.length) {
      return (
        <div className="dv-empty">
          <span>✦</span>
          <h3>Nada por aqui ainda</h3>
          <p>
            Experimente outra categoria ou faça uma nova busca.
          </p>
        </div>
      );
    }

    return (
      <div className="dv-grid">
        {items.map((item) => renderCard(item, type))}
      </div>
    );
  }

  const favoriteSeries = series.filter((item) =>
    isFavorite(item)
  );

  const favoriteMovies = movies.filter((item) =>
    isFavorite(item)
  );

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
