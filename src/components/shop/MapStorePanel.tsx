"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Store, Download, Heart, Search, Loader2, Info, Trophy, Map as MapIcon,
  Coins, Clock, Flame, User, CheckCircle2,
} from "lucide-react";
import MapPreviewCanvas from "@/components/MapPreviewCanvas";
import { UserMapEntity, MAP_DOWNLOAD_COST } from "@/core/entities/UserMap";
import {
  getStoreMapsAction, getMyDownloadsAction, getLikedMapIdsAction,
  downloadUserMapAction, toggleMapLikeAction,
} from "@/presentation/actions/userMapActions";
import { useUIStore } from "@/store/uiStore";
import { useChipStore } from "@/store/chipStore";

const LENGTH_LABEL: Record<string, string> = { Short: "숏", Middle: "미들", Long: "롱" };
const COMPLEXITY_LABEL: Record<string, string> = { Simple: "단순", Medium: "중간", Complex: "복잡" };

function lengthBadgeClass(label?: string) {
  return label === "숏" ? "bg-green-500/20 text-green-400" :
    label === "미들" ? "bg-blue-500/20 text-blue-400" :
    "bg-purple-500/20 text-purple-400";
}

function complexityBadgeClass(label?: string) {
  return label === "단순" ? "bg-emerald-500/20 text-emerald-400" :
    label === "중간" ? "bg-yellow-500/20 text-yellow-400" :
    "bg-red-500/20 text-red-400";
}

/** 커스텀 맵 스토어 — 상점의 세 번째 뷰 모드(에메랄드 테마) */
export default function MapStorePanel() {
  const { userProfile, isLoggedIn } = useUIStore();
  const { chips, deductChipsLocally } = useChipStore();

  const [maps, setMaps] = useState<UserMapEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"popular" | "latest">("popular");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownedSourceIds, setOwnedSourceIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStoreMapsAction({ sort: "popular", limit: 60 }),
      getMyDownloadsAction(),
      getLikedMapIdsAction(),
    ]).then(([store, downloads, likes]) => {
      if (cancelled) return;
      setLoading(false);
      if (store.success) {
        setMaps(store.maps);
        if (store.maps.length > 0) setSelectedId(store.maps[0].id);
      }
      if (downloads.success) {
        setOwnedSourceIds(new Set(downloads.downloads.map((d) => d.sourceMapId).filter(Boolean) as string[]));
      }
      if (likes.success) {
        setLikedIds(new Set(likes.mapIds));
      }
    });
    return () => { cancelled = true; };
  }, []);

  // 정렬/검색은 클라이언트에서 처리 (limit 60 단일 페이지)
  const visibleMaps = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = maps;
    if (q) {
      list = list.filter(
        (m) => m.name.toLowerCase().includes(q) || (m.creatorName || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "popular") {
        if (b.downloadCount !== a.downloadCount) return b.downloadCount - a.downloadCount;
      }
      return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
    });
  }, [maps, sort, search]);

  // 인기 1위 (다운로드 1회 이상)
  const topMapId = useMemo(() => {
    const top = [...maps].sort((a, b) => b.downloadCount - a.downloadCount)[0];
    return top && top.downloadCount > 0 ? top.id : null;
  }, [maps]);

  const selected = maps.find((m) => m.id === selectedId) || visibleMaps[0] || null;

  const isOwnedMap = (map: UserMapEntity) => ownedSourceIds.has(map.id);
  const isMyMap = (map: UserMapEntity) => !!userProfile?.id && map.ownerId === userProfile.id;

  const handleDownload = async (map: UserMapEntity) => {
    if (!isLoggedIn) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    if (isOwnedMap(map)) {
      toast.info("이미 보유 중인 맵입니다.");
      return;
    }
    if (!isMyMap(map) && chips < MAP_DOWNLOAD_COST) {
      toast.error(`칩이 부족합니다! (보유: ${chips.toLocaleString()}C / 필요: ${MAP_DOWNLOAD_COST}C)`);
      return;
    }

    setDownloadingId(map.id);
    try {
      const res = await downloadUserMapAction(map.id);
      if (!res.success) {
        toast.error(`다운로드 실패: ${res.error}`);
        return;
      }
      setOwnedSourceIds((prev) => new Set(prev).add(map.id));
      if (res.charged) {
        deductChipsLocally(MAP_DOWNLOAD_COST);
        setMaps((prev) =>
          prev.map((m) => (m.id === map.id ? { ...m, downloadCount: m.downloadCount + 1 } : m))
        );
        toast.success(`『${map.name}』 저장 완료! (-${MAP_DOWNLOAD_COST}칩) 맵 로드 창의 커스텀 맵 탭에서 사용할 수 있어요.`);
      } else {
        toast.success(`『${map.name}』 저장 완료! 맵 로드 창의 커스텀 맵 탭에서 사용할 수 있어요.`);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleLike = async (e: React.MouseEvent, map: UserMapEntity) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      toast.error("좋아요는 로그인 후 이용할 수 있습니다.");
      return;
    }
    const res = await toggleMapLikeAction(map.id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (res.liked) next.add(map.id);
      else next.delete(map.id);
      return next;
    });
    setMaps((prev) => prev.map((m) => (m.id === map.id ? { ...m, likeCount: res.likeCount } : m)));
  };

  const renderDownloadButton = (map: UserMapEntity, large: boolean) => {
    const base = large
      ? "px-8 py-2.5 font-extrabold text-base rounded-full flex items-center gap-2 border transition-all"
      : "px-3 py-1.5 font-bold text-xs rounded-full flex items-center gap-1.5 border transition-all";

    if (isMyMap(map)) {
      return (
        <button disabled className={`${base} bg-neutral-800/80 text-emerald-400/70 border-emerald-900/50`}>
          <User size={large ? 18 : 13} /> 내가 만든 맵
        </button>
      );
    }
    if (isOwnedMap(map)) {
      return (
        <button disabled className={`${base} bg-neutral-800/80 text-neutral-400 border-neutral-700`}>
          <CheckCircle2 size={large ? 18 : 13} /> 보유 중
        </button>
      );
    }
    const busy = downloadingId === map.id;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleDownload(map); }}
        disabled={busy}
        className={`${base} bg-gradient-to-r from-emerald-400 to-green-600 text-black border-emerald-300/50 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_30px_rgba(16,185,129,0.7)] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100`}
        title={`다운로드 비용 ${MAP_DOWNLOAD_COST}칩 — 전액 제작자에게 지급됩니다`}
      >
        {busy ? <Loader2 size={large ? 18 : 13} className="animate-spin" /> : <Download size={large ? 18 : 13} />}
        {MAP_DOWNLOAD_COST} 칩 다운로드
      </button>
    );
  };

  return (
    <>
      {/* 좌측: 쇼케이스 */}
      <div className="lg:col-span-5 flex flex-col gap-6 h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
        {/* 그라디언트 보더 래퍼 — 보관함보다 화려한 프리미엄 룩 */}
        <div className="relative w-full shrink-0 rounded-2xl p-[1.5px] bg-gradient-to-br from-emerald-300 via-green-500 to-teal-600 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
          <div className="absolute -inset-2 rounded-3xl bg-emerald-500/10 blur-2xl animate-pulse pointer-events-none" />
          <div className="relative w-full h-[560px] bg-[#06120C]/95 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
            <div className="absolute top-4 left-4 z-20">
              <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-green-600 border border-emerald-300 rounded-sm text-xs font-extrabold uppercase tracking-widest shadow-md text-black">
                맵 스토어
              </span>
            </div>

            <div className="relative flex-1 w-full min-h-[300px] flex items-center justify-center p-4 pt-12 overflow-hidden">
              {selected ? (
                <MapPreviewCanvas
                  mapData={selected.items as any}
                  worldHeight={selected.worldHeight}
                  className="max-h-full"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-emerald-900">
                  <MapIcon className="w-16 h-16" />
                  <span className="font-bold text-emerald-800">배포된 맵이 없습니다</span>
                </div>
              )}
            </div>

            {selected && (
              <div className="relative z-20 flex flex-col items-center text-center px-4 py-4 bg-gradient-to-t from-black/95 via-black/85 to-transparent">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text drop-shadow-md mb-1 bg-gradient-to-r from-emerald-200 via-green-300 to-teal-400">
                  {selected.name}
                </h2>
                <p className="text-emerald-300/70 text-xs mb-1 flex items-center gap-1">
                  <User size={12} /> {selected.creatorName || "알 수 없음"}
                </p>
                {selected.description && (
                  <p className="text-neutral-400 text-xs mb-2 max-w-sm leading-relaxed line-clamp-2">{selected.description}</p>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lengthBadgeClass(LENGTH_LABEL[selected.lengthType])}`}>
                    {LENGTH_LABEL[selected.lengthType]}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${complexityBadgeClass(COMPLEXITY_LABEL[selected.complexity])}`}>
                    {COMPLEXITY_LABEL[selected.complexity]}
                  </span>
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Download size={11} /> {selected.downloadCount.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Heart size={11} className={likedIds.has(selected.id) ? "text-rose-400 fill-rose-400" : ""} /> {selected.likeCount.toLocaleString()}
                  </span>
                </div>
                {renderDownloadButton(selected, true)}
                <p className="text-[10px] text-neutral-500 mt-2">다운로드한 맵은 영구 보관됩니다</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 우측: 스토어 리스트 */}
      <div className="lg:col-span-7 flex flex-col h-[calc(100vh-140px)] relative">
        {/* 툴바: 정렬 + 검색 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-neutral-900/70 border border-emerald-900/50 rounded-full p-1">
            <button
              onClick={() => setSort("popular")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                sort === "popular" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-black shadow" : "text-neutral-400 hover:text-emerald-300"
              }`}
            >
              <Flame size={14} /> 인기순
            </button>
            <button
              onClick={() => setSort("latest")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                sort === "latest" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-black shadow" : "text-neutral-400 hover:text-emerald-300"
              }`}
            >
              <Clock size={14} /> 최신순
            </button>
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="맵 이름 · 제작자 검색"
              className="w-full bg-neutral-900/70 border border-emerald-900/50 rounded-full pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-emerald-500/60 transition-colors"
            />
          </div>
        </div>

        {/* 칩 정책 안내 (요구사항: 정책을 설명에 명시) */}
        <div className="flex items-center gap-2 mt-3 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300">
          <Info size={14} className="shrink-0" />
          <span>
            맵 다운로드 <strong>{MAP_DOWNLOAD_COST}칩</strong> · 지불한 칩은 <strong>제작자에게 전액 지급</strong>됩니다. (유저당 최초 1회만 과금 · 재다운로드 무료)
          </span>
          <span className="ml-auto flex items-center gap-1 text-emerald-400 font-bold shrink-0">
            <Coins size={13} /> {isLoggedIn ? `${chips.toLocaleString()} C` : "로그인 필요"}
          </span>
        </div>

        {/* 카드 그리드 */}
        <div className="flex-1 overflow-y-auto pr-2 mt-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {loading ? (
            <div className="h-48 flex items-center justify-center gap-2 text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin" /> 스토어를 불러오는 중…
            </div>
          ) : !isLoggedIn ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-center bg-neutral-900/40 rounded-2xl border border-emerald-900/40">
              <Store className="w-12 h-12 text-emerald-700" />
              <p className="text-neutral-400 text-sm">커스텀 맵 스토어는 로그인 후 이용할 수 있습니다.</p>
            </div>
          ) : visibleMaps.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-center bg-neutral-900/40 rounded-2xl border border-emerald-900/40">
              <Store className="w-12 h-12 text-emerald-700" />
              <p className="text-neutral-400 text-sm">
                {search ? "검색 결과가 없습니다." : "아직 배포된 커스텀 맵이 없습니다. 첫 번째 제작자가 되어보세요!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              {visibleMaps.map((map) => {
                const isSelected = selected?.id === map.id;
                const lengthLabel = LENGTH_LABEL[map.lengthType];
                const complexityLabel = COMPLEXITY_LABEL[map.complexity];
                return (
                  <div
                    key={map.id}
                    onClick={() => setSelectedId(map.id)}
                    className={`relative p-4 rounded-xl border cursor-pointer transition-all flex gap-4 group overflow-hidden ${
                      isSelected
                        ? "bg-emerald-900/25 border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.2)]"
                        : "bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/50 hover:border-emerald-700/50"
                    }`}
                  >
                    {/* hover shine sweep */}
                    <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-emerald-200/5 to-transparent" />

                    {topMapId === map.id && (
                      <div className="absolute top-0 right-0 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[10px] font-extrabold px-2 py-0.5 rounded-bl-lg shadow">
                        <Trophy size={10} /> 인기 1위
                      </div>
                    )}

                    {/* 미니 맵 스트립 */}
                    <div className="w-14 h-36 shrink-0 rounded-lg bg-black/60 border border-neutral-800 overflow-hidden flex items-center justify-center">
                      <div style={{ transform: "scale(0.34)", transformOrigin: "center" }}>
                        <MapPreviewCanvas mapData={map.items as any} worldHeight={map.worldHeight} />
                      </div>
                    </div>

                    {/* 정보 */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <h3 className={`font-bold text-base truncate transition-colors ${isSelected ? "text-emerald-300" : "text-neutral-200 group-hover:text-white"}`}>
                        {map.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 truncate flex items-center gap-1 mt-0.5">
                        <User size={10} /> {map.creatorName || "알 수 없음"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lengthBadgeClass(lengthLabel)}`}>{lengthLabel}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${complexityBadgeClass(complexityLabel)}`}>{complexityLabel}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1"><Download size={11} /> {map.downloadCount.toLocaleString()}</span>
                        <button
                          onClick={(e) => handleToggleLike(e, map)}
                          className="flex items-center gap-1 hover:text-rose-400 transition-colors"
                          title="좋아요"
                        >
                          <Heart size={11} className={likedIds.has(map.id) ? "text-rose-400 fill-rose-400" : ""} />
                          {map.likeCount.toLocaleString()}
                        </button>
                      </div>
                      <div className="mt-auto pt-2">
                        {renderDownloadButton(map, false)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
