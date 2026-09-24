# Fuji 17K Training Dashboard

17K 富士山跑步動態訓練 Dashboard。

- 比賽日：2026-12-13
- 目標：17K / 2 小時內
- 網頁畫面：`index.html`
- 動態訓練資料：`data.json`
- 後續更新 Garmin 訓練成果時，主要更新 `data.json`

## GitHub Pages
在 repository 的 **Settings → Pages**：
1. Build and deployment 選 **Deploy from a branch**
2. Branch 選 **main**
3. Folder 選 **/(root)**
4. Save

發布後固定網址：
https://sharon30528-ching15.github.io/fuji17-training/

## 程式結構與資料維護

- `index.html`：頁面結構與主畫面圖示設定。
- `styles.css`：既有桌面／手機版樣式，保留原有覆蓋順序。
- `app.mjs`：安全 DOM 輸出、互動、資料載入與本機備援。
- `model.mjs`：日期、課表與統計計算；`model.test.mjs` 為回歸測試。
- 執行測試：`node model.test.mjs`。

### 更新紀錄

在 `data.json` 的 `results` 新增實績，使用 `dateISO`（YYYY-MM-DD）、`distanceKm`（數字）及 `sessionId`（例如 w5-thu）。改期實績使用實際跑步日期，保留原課程的 sessionId，並填入 scheduledDateISO。週／月跑量按實際日期計算，完成堂數按課程對應計算。

`plan[].sessions` 是日期、課程類型、距離上下限的主要來源。`weekSessions` 依 id 提供細部配速與教練說明；新增／調整課程時保持 id 一致。無已設定配速的課程不會自行推測配速。`paceProgress` 仍為教練評估資料，不是自動測得的能力。

週次依 `planStart`、`raceDate` 和 `timeZone` 計算，月曆預設目前月份（限制於備賽期間）。不要再手動維護總里程、最長距離、週完成里程與完成堂數；這些均由實績計算。

### 資料備援

成功讀取且驗證的資料會保存於此瀏覽器 localStorage。後續資料請求失敗會顯示備份日期及重新載入按鈕。這是資料備援，尚未加入 Service Worker，因此不保證完全離線時首次開啟網站。無法使用本機儲存時，線上功能仍可使用。

