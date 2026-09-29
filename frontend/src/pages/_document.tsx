import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f6f7fb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b132b" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preload" href="/fonts/source-sans-3-400-700-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/fraunces-400-700-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        {/* Sets data-theme before paint so there's no light->dark flash. Same
            mechanism as redesign-and-blend/*.html: a stored user choice wins,
            otherwise fall back to the OS setting. Kept as inline JS (not a
            React effect) because it has to run before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('ah-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}",
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
