import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";

import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";

import { useSelector } from "react-redux";

/* ────────────────────────────────────────────── */
/* MEDIA QUERY */
/* ────────────────────────────────────────────── */

function useMediaQuery(query) {
  const get = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;

    const mql = window.matchMedia(query);

    const onChange = () => setMatches(mql.matches);

    onChange();

    mql.addEventListener
      ? mql.addEventListener("change", onChange)
      : mql.addListener(onChange);

    return () => {
      mql.removeEventListener
        ? mql.removeEventListener("change", onChange)
        : mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/* ────────────────────────────────────────────── */
/* CLOUDINARY IMAGE BUILDER */
/* ────────────────────────────────────────────── */

function buildSliderResponsiveImage(url) {
  if (!url || typeof url !== "string") {
    return {
      src: "",
      srcSet: "",
    };
  }

  const trimmed = url.trim();

  const m = trimmed.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)([^?]+)(\?.*)?$/i
  );

  if (!m) {
    return {
      src: trimmed,
      srcSet: `${trimmed} 1x`,
    };
  }

  const [, prefix, pathPart, query = ""] = m;

  const suffix = `${pathPart}${query}`;

  const transform = "f_auto,q_auto:best";

  const sized = (w) =>
    `${prefix}${transform},w_${w},c_limit/${suffix}`;

  const widths = [480, 768, 1080, 1440, 1920];

  return {
    src: sized(1920),
    srcSet: widths.map((w) => `${sized(w)} ${w}w`).join(", "),
  };
}

/* ────────────────────────────────────────────── */
/* CONSTANTS */
/* ────────────────────────────────────────────── */

const SECTION_ID =
  "template--15265873625193__1621243260e1af0c20";

const BUTTON_TEXT = "Shop Now";

const ASPECT_RATIO = "2.16";

const ASPECT_RATIO_MOBILE = "0.88";

const AUTOPLAY_DELAY_MS = 4000;

const TRANSITION_SPEED_MS = 1100;

/* ────────────────────────────────────────────── */

function shopNowPath(slide) {
  const raw = slide?.categoryId;

  if (
    raw != null &&
    raw !== "" &&
    Number.isFinite(Number(raw))
  ) {
    return `/AllProducts?categoryId=${encodeURIComponent(
      String(raw)
    )}`;
  }

  return "/AllProducts";
}

/* ────────────────────────────────────────────── */
/* ICON */
/* ────────────────────────────────────────────── */

const ArrowIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
  >
    <path
      d="M2 5h6M5.5 2.5L8 5l-2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ────────────────────────────────────────────── */
/* SLIDE CONTENT */
/* ────────────────────────────────────────────── */

function SlideContent({
  slide,
  navigate,
  isMobile,
}) {
  const desktopImg = slide?.images?.desktop;

  const mobileImg = slide?.images?.mobile;

  const hasMobile = Boolean(
    mobileImg &&
      (mobileImg.src || mobileImg.srcSet)
  );

  const safeImg = desktopImg;

  return (
    <div
      className="m-slide"
      style={{
        "--ms-tag":
          slide?.theme?.tagColor || "#ffffff",

        "--ms-tag-line":
          slide?.theme?.tagLineColor ||
          "rgba(255,255,255,.45)",

        "--ms-h1":
          slide?.theme?.headline1Color ||
          "#ffffff",

        "--ms-h2":
          slide?.theme?.headline2Color ||
          "#ffffff",

        "--ms-sub":
          slide?.theme?.subheadingColor ||
          "rgba(255,255,255,.8)",

        "--ms-btn-bg":
          slide?.theme?.buttonBg || "#000",

        "--ms-btn-fg":
          slide?.theme?.buttonText || "#fff",
      }}
    >
      {/* IMAGE */}

      <div
        className="m-slide__media"
        style={{
          "--aspect-ratio": ASPECT_RATIO,
          "--aspect-ratio-mobile":
            ASPECT_RATIO_MOBILE,
        }}
      >
        <div className="m-slide__bg">
          {/* BLUR IMAGE */}

          <picture
            key={`blur-${slide.id}-${
              isMobile ? "mobile" : "desktop"
            }`}
            className="ms-bg__picture ms-bg__picture--blur"
          >
            {hasMobile && (
              <source
                media="(max-width: 767px)"
                srcSet={
                  mobileImg.srcSet ||
                  mobileImg.src
                }
                sizes="100vw"
              />
            )}

            <source
              media="(min-width: 768px)"
              srcSet={
                desktopImg?.srcSet ||
                desktopImg?.src
              }
              sizes="100vw"
            />

            <img
              className="ms-bg__blur"
              src={safeImg?.src}
              srcSet={safeImg?.srcSet}
              sizes="100vw"
              alt=""
            />
          </picture>

          {/* MAIN IMAGE */}

          <picture
            key={`${slide.id}-${
              isMobile ? "mobile" : "desktop"
            }`}
            className="ms-bg__picture ms-bg__picture--main"
          >
            {hasMobile && (
              <source
                media="(max-width: 767px)"
                srcSet={
                  mobileImg.srcSet ||
                  mobileImg.src
                }
                sizes="100vw"
              />
            )}

            <source
              media="(min-width: 768px)"
              srcSet={
                desktopImg?.srcSet ||
                desktopImg?.src
              }
              sizes="100vw"
            />

            <img
              className="ms-bg__img"
              src={safeImg?.src}
              srcSet={safeImg?.srcSet}
              sizes="100vw"
              alt="Banner"
            />
          </picture>
        </div>
      </div>

      {/* CONTENT */}

      <div className="ms-content">
        <span className="ms-tag">
          {slide.title}
        </span>

        <h2 className="ms-title">
          {Array.isArray(slide.subtitle) ? (
            <>
              <span>
                {slide.subtitle[0]}
              </span>

              <br />

              <span>
                {slide.subtitle[1]}
              </span>
            </>
          ) : (
            slide.subtitle
          )}
        </h2>

        <button
          className="ms-btn"
          onClick={() =>
            navigate(shopNowPath(slide))
          }
        >
          <span>{BUTTON_TEXT}</span>

          <span className="ms-btn-circle">
            <ArrowIcon />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* MAIN COMPONENT */
/* ────────────────────────────────────────────── */

function Slider() {
  const navigate = useNavigate();

  const isMobile = useMediaQuery(
    "(max-width: 767px)"
  );

  const swiperRef = useRef(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const slides = useSelector((state) =>
    Array.isArray(state.slider)
      ? state.slider
      : []
  );

  const desktopDots = useMemo(() => {
    return Array.from(
      { length: slides.length },
      (_, i) => i
    );
  }, [slides]);

  return (
    <section
      id={`m-slider-${SECTION_ID}`}
      className="hero-slider"
    >
      <style>{`

      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

      .hero-slider {
        position: relative;
        width: 100%;
      }

      .m-slide {
        position: relative;
        overflow: hidden;
      }

      .m-slide::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to right,
          rgba(0,0,0,.08),
          rgba(0,0,0,0)
        );
        z-index: 2;
        pointer-events: none;
      }

      .m-slide__media {
        width: 100%;
        aspect-ratio: var(--aspect-ratio);
        position: relative;
      }

      @media (max-width: 767px) {
        .m-slide__media {
          aspect-ratio: var(--aspect-ratio-mobile);
        }
      }

      .m-slide__bg {
        position: absolute;
        inset: 0;
      }

      .ms-bg__picture {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .ms-bg__picture img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .ms-bg__img {
        object-position: center center;
      }

      .ms-bg__blur {
        filter: blur(18px);
        transform: scale(1.08);
        opacity: .5;
      }

      /* CONTENT */

      .ms-content {
        position: absolute;
        z-index: 5;

        left: 5%;
        top: 50%;

        transform: translateY(-50%);

        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;

        max-width: 540px;
      }

      @media (max-width: 767px) {
        .ms-content {
          left: 20px;
          right: 20px;

          bottom: 40px;
          top: auto;

          transform: none;

          max-width: 100%;
        }
      }

      /* TAG */

      .ms-tag {
        color: var(--ms-tag);

        font-family: 'Inter', sans-serif;

        font-size: 12px;

        letter-spacing: 3px;

        text-transform: uppercase;

        margin-bottom: 12px;

        font-weight: 500;
      }

      /* TITLE */

      .ms-title {
        font-family: 'Playfair Display', serif;

        font-size: clamp(56px, 5vw, 82px);

        line-height: 1.02;

        margin: 14px 0 24px;

        letter-spacing: -2px;

        font-weight: 700;
      }

      .ms-title span:first-child {
        color: var(--ms-h1);
      }

      .ms-title span:last-child {
        color: var(--ms-h2);
      }

      @media (max-width: 767px) {
        .ms-title {
          font-size: 42px;
          line-height: 1.05;
          letter-spacing: -1px;
        }
      }

      /* BUTTON */

      .ms-btn {
        display: inline-flex;
        align-items: center;
        gap: 14px;

        border: none;

        background: var(--ms-btn-bg);

        color: var(--ms-btn-fg);

        cursor: pointer;

        padding: 14px 26px;

        border-radius: 8px;

        font-family: 'Inter', sans-serif;

        font-size: 15px;

        font-weight: 500;

        transition: all .25s ease;
      }

      .ms-btn:hover {
        transform: translateY(-2px);
      }

      .ms-btn-circle {
        width: 34px;
        height: 34px;

        border-radius: 50%;

        border: 1px solid var(--ms-btn-fg);

        display: flex;
        align-items: center;
        justify-content: center;

        background: transparent;
      }

      /* DOTS */

      .ms-desktop-dots {
        position: absolute;

        left: 50%;
        bottom: 18px;

        transform: translateX(-50%);

        z-index: 20;

        display: flex;

        gap: 8px;
      }

      .ms-desktop-dot {
        width: 8px;
        height: 8px;

        border-radius: 999px;

        border: none;

        background: rgba(255,255,255,.4);

        cursor: pointer;

        transition: all .2s ease;
      }

      .ms-desktop-dot.active {
        background: #fff;
        transform: scale(1.2);
      }

      `}</style>

      <Swiper
        modules={[
          Autoplay,
          Pagination,
          EffectFade,
        ]}
        effect="fade"
        fadeEffect={{
          crossFade: true,
        }}
        loop
        speed={TRANSITION_SPEED_MS}
        slidesPerView={1}
        autoplay={{
          delay: AUTOPLAY_DELAY_MS,
          disableOnInteraction: false,
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;

          setActiveIndex(
            Number(swiper.realIndex || 0)
          );
        }}
        onSlideChange={(swiper) => {
          setActiveIndex(
            Number(swiper.realIndex || 0)
          );
        }}
      >
        {slides.map((slide, index) => {
          const desktop =
            buildSliderResponsiveImage(
              slide.images
            );

          const mobileUrl =
            slide.mobileImageUrl ||
            slide.mobileImage ||
            slide.imagesMobile ||
            slide.mobileImages ||
            null;

          const mobile = mobileUrl
            ? buildSliderResponsiveImage(
                mobileUrl
              )
            : null;

          const mappedSlide = {
            ...slide,
            images: {
              desktop,
              ...(mobile
                ? { mobile }
                : {}),
            },
          };

          return (
            <SwiperSlide
              key={slide._id || index}
            >
              <SlideContent
                slide={mappedSlide}
                navigate={navigate}
                isMobile={isMobile}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>

      {desktopDots.length > 1 && (
        <div className="ms-desktop-dots">
          {desktopDots.map((i) => (
            <button
              key={i}
              className={`ms-desktop-dot ${
                activeIndex === i
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                swiperRef.current?.slideToLoop(i)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default Slider;