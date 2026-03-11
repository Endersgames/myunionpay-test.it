import AppProviders from "@/components/AppProviders";
import "@/index.css";
import "@/App.css";
import Script from "next/script";

const title = "myUup.com - Paga. Guadagna. Unisciti.";
const description = "myUup.com - App PWA per pagamenti peer-to-peer tramite QR Code";
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export const metadata = {
  title,
  description,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "myUup",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2B7AB8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        <Script id="pwa-install-prompt" strategy="beforeInteractive">
          {`
            window.__pwaInstallPrompt = null;
            window.__pwaInstallOutcome = null;
            window.addEventListener('beforeinstallprompt', function(event) {
              event.preventDefault();
              window.__pwaInstallPrompt = event;
            });
            window.addEventListener('appinstalled', function() {
              window.__pwaInstallPrompt = null;
              window.__pwaInstallOutcome = 'installed';
            });
          `}
        </Script>
        <Script id="chunk-load-recovery" strategy="beforeInteractive">
          {`
            (function() {
              var reloadKey = "__next_chunk_reload__";

              function reloadOnce() {
                try {
                  if (sessionStorage.getItem(reloadKey)) {
                    return;
                  }

                  sessionStorage.setItem(reloadKey, "1");
                } catch (error) {}

                window.location.reload();
              }

              window.addEventListener("error", function(event) {
                var target = event && event.target;

                if (
                  target &&
                  target.tagName === "SCRIPT" &&
                  typeof target.src === "string" &&
                  target.src.indexOf("/_next/static/") !== -1
                ) {
                  reloadOnce();
                }
              }, true);

              window.addEventListener("unhandledrejection", function(event) {
                var reason = event && event.reason;
                var message = reason ? String(reason.message || reason) : "";

                if (
                  (reason && reason.name === "ChunkLoadError") ||
                  /Loading chunk [0-9]+ failed/i.test(message) ||
                  /ChunkLoadError/i.test(message) ||
                  /Failed to fetch dynamically imported module/i.test(message)
                ) {
                  reloadOnce();
                }
              });

              window.addEventListener("load", function() {
                try {
                  sessionStorage.removeItem(reloadKey);
                } catch (error) {}
              });
            })();
          `}
        </Script>
        {posthogKey && (
          <Script id="posthog-init" strategy="afterInteractive">
            {`
              !(function(t,e){var o,n,p,r;e.__SV||((window.posthog=e),(e._i=[]),(e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&((t=t[o[0]]),(e=o[1])),(t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)));});}((p=t.createElement("script")).type="text/javascript"),(p.crossOrigin="anonymous"),(p.async=!0),(p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js"),(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?(u=e[a]=[]):(a="posthog"),u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e;},u.people.toString=function(){return u.toString(1)+".people (stub)";},o="init me ws ys ps bs capture je Di ks register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Es $s createPersonProfile Is opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Ss debug xs getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a]);}),(e.__SV=1));})(document,window.posthog||[]);
              posthog.init("${posthogKey}", {
                api_host: "${posthogHost}",
                person_profiles: 'identified_only',
                disable_session_recording: true
              });
            `}
          </Script>
        )}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
