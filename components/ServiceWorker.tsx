"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/demo";

/**
 * 서비스 워커 등록. 새 버전이 오면 한 번 새로고침해 옛 화면에 갇히지 않게 한다.
 * (아이폰 홈 화면 앱은 추가 당시 화면을 오래 캐시한다)
 */
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // 첫 설치 때의 clients.claim() 으로는 새로고침하지 않고, 그 뒤의 교체(=업데이트)에만 새로고침한다
    let controlled = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onChange = () => {
      if (!controlled) {
        controlled = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
      .then((reg) => {
        void reg.update();
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) next.postMessage("skip-waiting");
          });
        });
        // 앱으로 돌아올 때마다 새 버전이 있는지 확인
        const check = () => document.visibilityState === "visible" && void reg.update();
        document.addEventListener("visibilitychange", check);
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);
  return null;
}
