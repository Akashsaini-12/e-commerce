import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchSliderSlides,
  fetchShopCategories,
  createSliderSlide,
  updateSliderSlide,
  deleteSliderSlide,
  uploadImageToCloudinary,
} from "../../redux/actions";

const SLIDES_API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:4000`
    : "");

const EMPTY_SLIDE_THEME = {
  tagColor: "",
  tagLineColor: "",
  headline1Color: "",
  headline2Color: "",
  subheadingColor: "",
  buttonBg: "",
  buttonText: "",
};

function normalizeThemeFromApi(t) {
  if (!t || typeof t !== "object") return { ...EMPTY_SLIDE_THEME };
  return {
    tagColor: String(t.tagColor || "").trim(),
    tagLineColor: String(t.tagLineColor || "").trim(),
    headline1Color: String(t.headline1Color || "").trim(),
    headline2Color: String(t.headline2Color || "").trim(),
    subheadingColor: String(t.subheadingColor || "").trim(),
    buttonBg: String(t.buttonBg || "").trim(),
    buttonText: String(t.buttonText || "").trim(),
  };
}

function ColorThemeField({ label, value, onChange, hint }) {
  const safe = typeof value === "string" ? value.trim() : "";
  const pickerVal = /^#[0-9a-fA-F]{6}$/.test(safe) ? safe : "#e8dcc8";
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <label className="form-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="color"
          value={pickerVal}
          onChange={(e) => onChange(e.target.value)}
          title="Pick colour"
          style={{
            width: 42,
            height: 38,
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: 8,
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <input
          className="form-input"
          style={{ flex: 1 }}
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#aa8b45 or empty for default"
        />
        {safe ? (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "6px 10px", flexShrink: 0 }}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      {hint ? (
        <div
          style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

async function fetchCategoriesForSlidesAdmin() {
  if (!SLIDES_API_BASE) return [];
  const res = await fetch(`${SLIDES_API_BASE}/api/categories`);
  if (!res.ok) throw new Error(`Categories request failed (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((c) => {
      const id = c.id != null ? Number(c.id) : NaN;
      if (!Number.isFinite(id)) return null;
      return {
        id,
        title: String(c.title || "").trim() || `Category #${id}`,
        parentId:
          c.parentId != null && c.parentId !== ""
            ? Number(c.parentId)
            : null,
        sortOrder: Number(c.sortOrder) || 0,
      };
    })
    .filter(Boolean);
}

function SlidesAdminSection() {
  const [slides, setSlides] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [mobileImageFile, setMobileImageFile] = useState(null);
  const [slideForm, setSlideForm] = useState({
    title: "",
    subtitleLine1: "",
    subtitleLine2: "",
    subheading: "",
    image: "",
    mobileImage: "",
    categoryId: "",
    status: "Active",
    order: "",
    theme: { ...EMPTY_SLIDE_THEME },
  });

  const [editSlideId, setEditSlideId] = useState(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadError, setEditUploadError] = useState("");
  const [editImageFile, setEditImageFile] = useState(null);
  const [editMobileImageFile, setEditMobileImageFile] = useState(null);
  const [editSlideForm, setEditSlideForm] = useState({
    title: "",
    subtitleLine1: "",
    subtitleLine2: "",
    subheading: "",
    image: "",
    mobileImage: "",
    categoryId: "",
    theme: { ...EMPTY_SLIDE_THEME },
  });

  const reduxSlides = useSelector((state) => state.slider);
  const shopCategories = useSelector((state) => state.shopCategories || []);
  const dispatch = useDispatch();

  const [slideCategories, setSlideCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const loadSlideCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const rows = await fetchCategoriesForSlidesAdmin();
      setSlideCategories(rows);
    } catch (e) {
      setCategoriesError(
        e?.message || "Could not load categories. Check API / backend.",
      );
      setSlideCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchSliderSlides());
    dispatch(fetchShopCategories());
    loadSlideCategories();
  }, [dispatch]);

  useEffect(() => {
    if (!modalOpen && !editModalOpen) return;
    loadSlideCategories();
  }, [modalOpen, editModalOpen]);

  const categoryRows = useMemo(() => {
    if (slideCategories.length) return slideCategories;
    return (shopCategories || [])
      .map((c) => {
        const id = c.id != null ? Number(c.id) : NaN;
        if (!Number.isFinite(id)) return null;
        return {
          id,
          title: String(c.title || "").trim() || `Category #${id}`,
          parentId:
            c.parentId != null && c.parentId !== ""
              ? Number(c.parentId)
              : null,
          sortOrder: Number(c.sortOrder) || 0,
        };
      })
      .filter(Boolean);
  }, [slideCategories, shopCategories]);

  const categoryTitleById = useMemo(() => {
    const m = new Map();
    categoryRows.forEach((c) => {
      if (c && c.id != null) m.set(Number(c.id), c.title || "");
    });
    return m;
  }, [categoryRows]);

  const sortedCategoryRows = useMemo(
    () =>
      [...categoryRows].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0),
      ),
    [categoryRows],
  );

  const editCategorySelectRows = useMemo(() => {
    const raw = editSlideForm.categoryId;
    if (raw === "" || raw == null) return sortedCategoryRows;
    const has = sortedCategoryRows.some((c) => String(c.id) === String(raw));
    if (has) return sortedCategoryRows;
    const n = Number(raw);
    if (!Number.isFinite(n)) return sortedCategoryRows;
    return [
      {
        id: n,
        title: `Category #${n} (reload list if missing)`,
        parentId: null,
        sortOrder: -999,
      },
      ...sortedCategoryRows,
    ];
  }, [sortedCategoryRows, editSlideForm.categoryId]);

  // Helper: normalise image URL from different backend shapes
  const getSlideImage = (slide) => {
    // New API: `images` is a direct URL string
    if (typeof slide.images === "string" && slide.images) return slide.images;
    // Older shape: images.desktop.src
    if (slide.images?.desktop?.src) return slide.images.desktop.src;
    // Fallbacks
    if (slide.image) return slide.image;
    return "";
  };

  const getSlideMobileImage = (slide) => {
    if (typeof slide.mobileImageUrl === "string" && slide.mobileImageUrl)
      return slide.mobileImageUrl;
    if (typeof slide.mobileImage === "string" && slide.mobileImage)
      return slide.mobileImage;
    if (typeof slide.imagesMobile === "string" && slide.imagesMobile)
      return slide.imagesMobile;
    if (typeof slide.mobileImages === "string" && slide.mobileImages)
      return slide.mobileImages;
    if (slide.images?.mobile?.src) return slide.images.mobile.src;
    return "";
  };

  useEffect(() => {
    if (reduxSlides && reduxSlides.length > 0) {
      setSlides(
        reduxSlides.map((slide) => ({
          id: slide.id || slide._id,
          // backend: title = "New Arrivals" (string), subtitle = ["line1", "line2"]
          title: slide.title || "",
          subtitle: Array.isArray(slide.subtitle)
            ? slide.subtitle
            : [slide.subtitle || "", ""],
          image: getSlideImage(slide),
          mobileImage: getSlideMobileImage(slide),
          categoryId:
            slide.categoryId != null && Number.isFinite(Number(slide.categoryId))
              ? Number(slide.categoryId)
              : null,
          status: "Active",
          order: slide.id || slide._id,
          theme: normalizeThemeFromApi(slide.theme),
          subheading: String(slide.subheading || "").trim(),
        })),
      );
    }
  }, [reduxSlides]);

  const addSlide = async () => {
    try {
      setUploading(true);
      setUploadError("");

      let imageUrl = slideForm.image;
      let mobileImageUrl = slideForm.mobileImage;

      // If a file was chosen, upload it now (on submit)
      if (imageFile) {
        imageUrl = await uploadImageToCloudinary(imageFile);
      }
      if (mobileImageFile) {
        mobileImageUrl = await uploadImageToCloudinary(mobileImageFile);
      }
      const payload = {
        title: slideForm.title,
        subtitle: [slideForm.subtitleLine1, slideForm.subtitleLine2],
        subheading: slideForm.subheading,
        imageUrl,
        mobileImageUrl: mobileImageUrl || "",
        categoryId:
          slideForm.categoryId === "" || slideForm.categoryId == null
            ? null
            : Number(slideForm.categoryId),
        theme: slideForm.theme,
      };

      // Call shared API helper; throws on error.
      const saved = await createSliderSlide(payload);

      const newSlide = {
        id: saved.id,
        title: saved.title,
        subtitle: saved.subtitle,
        image: saved.images || imageUrl,
        mobileImage: saved.mobileImageUrl || saved.mobileImage || mobileImageUrl,
        categoryId:
          saved.categoryId != null && Number.isFinite(Number(saved.categoryId))
            ? Number(saved.categoryId)
            : null,
        status: slideForm.status,
        order: saved.id,
        theme: normalizeThemeFromApi(saved.theme),
        subheading: String(saved.subheading || "").trim(),
      };

      // If API call was successful, update UI and clear form/modal
      setSlides((prev) => [...prev, newSlide]);
      setModalOpen(false);
      setImageFile(null);
      setMobileImageFile(null);
      setSlideForm({
        title: "",
        subtitleLine1: "",
        subtitleLine2: "",
        subheading: "",
        image: "",
        mobileImage: "",
        categoryId: "",
        status: "Active",
        order: "",
        theme: { ...EMPTY_SLIDE_THEME },
      });
    } catch (err) {
      setUploadError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const deleteSlide = async (id) => {
    if (!id) return;
    const ok = window.confirm("Delete this slider slide?");
    if (!ok) return;
    setDeletingId(id);
    setUploadError("");
    try {
      await deleteSliderSlide(id);
      dispatch(fetchSliderSlides());
    } catch (err) {
      setUploadError(err?.message || "Failed to delete slide");
    } finally {
      setDeletingId(null);
    }
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Frontend guard: only allow image/* files
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }

    // Store file for later upload on submit
    setImageFile(file);
    setUploadError("");

    // Optional: show local preview before upload
    const previewUrl = URL.createObjectURL(file);
    setSlideForm((prev) => ({ ...prev, image: previewUrl }));
  };

  const handleMobileImageFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }
    setMobileImageFile(file);
    setUploadError("");
    const previewUrl = URL.createObjectURL(file);
    setSlideForm((prev) => ({ ...prev, mobileImage: previewUrl }));
  };

  const openEdit = (slide) => {
    const slideId = slide?.id || slide?._id;
    setEditSlideId(slideId);
    setEditImageFile(null);
    setEditMobileImageFile(null);
    setEditUploadError("");
    setEditSlideForm({
      title: slide?.title || "",
      subtitleLine1: Array.isArray(slide?.subtitle) ? slide.subtitle[0] || "" : "",
      subtitleLine2: Array.isArray(slide?.subtitle) ? slide.subtitle[1] || "" : "",
      subheading: String(slide?.subheading || "").trim(),
      image: slide?.image || "",
      mobileImage: slide?.mobileImage || "",
      categoryId:
        slide?.categoryId != null && Number.isFinite(Number(slide.categoryId))
          ? String(slide.categoryId)
          : "",
      theme: normalizeThemeFromApi(slide?.theme),
    });
    setEditModalOpen(true);
  };

  const handleEditImageFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setEditUploadError("Only image files are allowed");
      return;
    }

    setEditImageFile(file);
    setEditUploadError("");
    const previewUrl = URL.createObjectURL(file);
    setEditSlideForm((prev) => ({ ...prev, image: previewUrl }));
  };

  const handleEditMobileImageFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditUploadError("Only image files are allowed");
      return;
    }
    setEditMobileImageFile(file);
    setEditUploadError("");
    const previewUrl = URL.createObjectURL(file);
    setEditSlideForm((prev) => ({ ...prev, mobileImage: previewUrl }));
  };

  const saveEditSlide = async () => {
    if (!editSlideId) return;
    try {
      setEditUploading(true);
      setEditUploadError("");

      let imageUrl = editSlideForm.image;
      let mobileImageUrl = editSlideForm.mobileImage;
      if (editImageFile) {
        imageUrl = await uploadImageToCloudinary(editImageFile);
      }
      if (editMobileImageFile) {
        mobileImageUrl = await uploadImageToCloudinary(editMobileImageFile);
      }

      const payload = {
        title: editSlideForm.title,
        subtitle: [editSlideForm.subtitleLine1, editSlideForm.subtitleLine2],
        subheading: editSlideForm.subheading,
        imageUrl,
        mobileImageUrl: mobileImageUrl || "",
        categoryId:
          editSlideForm.categoryId === "" || editSlideForm.categoryId == null
            ? null
            : Number(editSlideForm.categoryId),
        theme: editSlideForm.theme,
      };

      await updateSliderSlide(editSlideId, payload);
      setEditModalOpen(false);
      setEditImageFile(null);
      dispatch(fetchSliderSlides());
    } catch (err) {
      setEditUploadError(err?.message || "Failed to update slide");
    } finally {
      setEditUploading(false);
    }
  };

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <div className="section-title">Banner Slides</div>
          <div className="section-desc">
            Homepage hero — copy, image, category link, and optional text colours
          </div>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setModalOpen(true)}
        >
          + Add Slide
        </button>
      </div>

      <div className="slides-grid">
        {slides.map((s) => {
          const th = s.theme || EMPTY_SLIDE_THEME;
          return (
          <div className="slide-card" key={s.id}>
            {s.image && (
              <div
                style={{
                  position: "relative",
                  borderRadius: "10px 10px 0 0",
                  overflow: "hidden",
                }}
              >
                <img
                  className="slide-img"
                  src={s.image}
                  alt={
                    s.title ||
                    (Array.isArray(s.subtitle)
                      ? `${s.subtitle[0] || ""} ${s.subtitle[1] || ""}`.trim()
                      : "")
                  }
                  style={{ display: "block", width: "100%", height: 140, objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background:
                      "linear-gradient(110deg, rgba(252,250,245,0.92) 0%, rgba(252,250,245,0.45) 42%, transparent 68%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 10,
                    maxWidth: "58%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 1,
                        background: th.tagLineColor || "rgba(120,90,40,0.45)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: th.tagColor || "#9a7347",
                      }}
                    >
                      {(s.title || "Tag").slice(0, 24)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: 15,
                      lineHeight: 1.15,
                      color: th.headline1Color || "#3d2918",
                      textShadow: "0 1px 12px rgba(255,255,255,0.6)",
                    }}
                  >
                    {(Array.isArray(s.subtitle) && s.subtitle[0]) || "Headline"}
                    {Array.isArray(s.subtitle) && s.subtitle[1] ? (
                      <>
                        <br />
                        <span
                          style={{ color: th.headline2Color || "#6b1a2d" }}
                        >
                          {s.subtitle[1]}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {s.subheading ? (
                    <div
                      style={{
                        fontFamily:
                          "system-ui, -apple-system, Segoe UI, sans-serif",
                        fontSize: 10,
                        fontWeight: 400,
                        marginTop: 5,
                        lineHeight: 1.35,
                        color: th.subheadingColor || "#5c534c",
                      }}
                    >
                      {String(s.subheading).slice(0, 80)}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      padding: "5px 12px",
                      borderRadius: 4,
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      background: th.buttonBg || "rgba(107,26,45,0.9)",
                      color: th.buttonText || "#fff",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    }}
                  >
                    Shop now
                  </div>
                </div>
              </div>
            )}
            <div className="slide-body">
              <div className="slide-title">
                {Array.isArray(s.subtitle) &&
                  (s.subtitle[0] || s.subtitle[1]) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 4,
                      }}
                    >
                      {s.subtitle[0]}
                      <br />
                      {s.subtitle[1]}
                    </div>
                  )}
                <div>{s.title}</div>
              </div>
              <div className="slide-meta">
                <span className="status-pill status-active">{s.status}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="action-btn action-edit"
                    type="button"
                    onClick={() => openEdit(s)}
                    disabled={deletingId === s.id}
                    title="Edit slide"
                  >
                    ✏️
                  </button>
                  <button
                    className="action-btn action-del"
                    type="button"
                    onClick={() => deleteSlide(s.id)}
                    disabled={deletingId === s.id}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="slide-order">Order: #{s.order}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginTop: 6,
                }}
              >
                Shop Now:{" "}
                {s.categoryId != null && s.categoryId !== ""
                  ? categoryTitleById.get(Number(s.categoryId)) ||
                    `Category #${s.categoryId}`
                  : "All products"}
              </div>
            </div>
          </div>
          );
        })}
        <div className="slide-card add-card" onClick={() => setModalOpen(true)}>
          <div className="add-icon">+</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Add New Slide</div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add New Slide</div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  value={slideForm.title}
                  onChange={(e) =>
                    setSlideForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. New Arrivals"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subtitle Line 1</label>
                <input
                  className="form-input"
                  value={slideForm.subtitleLine1}
                  onChange={(e) =>
                    setSlideForm((p) => ({
                      ...p,
                      subtitleLine1: e.target.value,
                    }))
                  }
                  placeholder="e.g. New Arrivals"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subtitle Line 2</label>
                <input
                  className="form-input"
                  value={slideForm.subtitleLine2}
                  onChange={(e) =>
                    setSlideForm((p) => ({
                      ...p,
                      subtitleLine2: e.target.value,
                    }))
                  }
                  placeholder="e.g. Drop 01"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subheading (optional)</label>
                <input
                  className="form-input"
                  value={slideForm.subheading}
                  onChange={(e) =>
                    setSlideForm((p) => ({ ...p, subheading: e.target.value }))
                  }
                  placeholder='e.g. Elegant Kurtis for Every You'
                />
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  margin: "16px 0 12px",
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 10,
                    fontSize: 14,
                  }}
                >
                  Text &amp; button colors (optional)
                </div>
                <ColorThemeField
                  label="Eyebrow label (title)"
                  value={slideForm.theme.tagColor}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, tagColor: v },
                    }))
                  }
                  hint="Small uppercase line next to the dash. Empty = default white/cream on storefront."
                />
                <ColorThemeField
                  label="Eyebrow dash / line"
                  value={slideForm.theme.tagLineColor}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, tagLineColor: v },
                    }))
                  }
                  hint="Thin line beside the eyebrow text."
                />
                <ColorThemeField
                  label="Headline line 1"
                  value={slideForm.theme.headline1Color}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, headline1Color: v },
                    }))
                  }
                  hint="First line of the large heading (subtitle line 1)."
                />
                <ColorThemeField
                  label="Headline line 2"
                  value={slideForm.theme.headline2Color}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, headline2Color: v },
                    }))
                  }
                  hint="Accent line of the heading (subtitle line 2)."
                />
                <ColorThemeField
                  label="Subheading"
                  value={slideForm.theme.subheadingColor}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, subheadingColor: v },
                    }))
                  }
                  hint="Small line under the headline (sans-serif)."
                />
                <ColorThemeField
                  label="Shop Now — button background"
                  value={slideForm.theme.buttonBg}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, buttonBg: v },
                    }))
                  }
                  hint="When set, the CTA becomes a solid pill. Button text color below."
                />
                <ColorThemeField
                  label="Shop Now — button text"
                  value={slideForm.theme.buttonText}
                  onChange={(v) =>
                    setSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, buttonText: v },
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Shop Now — link to category (optional)
                </label>
                <select
                  className="form-select"
                  value={slideForm.categoryId}
                  onChange={(e) =>
                    setSlideForm((p) => ({ ...p, categoryId: e.target.value }))
                  }
                  disabled={categoriesLoading}
                >
                  <option value="">
                    {categoriesLoading
                      ? "Loading categories…"
                      : "All products (no filter)"}
                  </option>
                  {sortedCategoryRows.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.parentId != null ? `↳ ${c.title}` : c.title}
                    </option>
                  ))}
                </select>
                {categoriesError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--accent2)",
                      marginTop: 6,
                    }}
                  >
                    {categoriesError}{" "}
                    <button
                      type="button"
                      className="action-btn action-edit"
                      style={{ marginLeft: 8, fontSize: 11 }}
                      onClick={() => loadSlideCategories()}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!categoriesLoading &&
                  !categoriesError &&
                  sortedCategoryRows.length === 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--accent2)",
                        marginTop: 6,
                      }}
                    >
                      No categories returned from API. Add categories in
                      Categories admin or check backend URL (
                      {SLIDES_API_BASE || "REACT_APP_API_BASE_URL"}).
                    </div>
                  )}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 6,
                  }}
                >
                  Homepage &quot;Shop Now&quot; opens All Products filtered by
                  this category.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Upload Image</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                />
                {uploading && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 6,
                    }}
                  >
                    Uploading image...
                  </div>
                )}
                {uploadError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--accent2)",
                      marginTop: 6,
                    }}
                  >
                    {uploadError}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Upload Mobile Image (optional)</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={handleMobileImageFileChange}
                />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  If your desktop banner looks cropped on mobile, upload a separate mobile banner here.
                </div>
              </div>
              {slideForm.image && (
                <div
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={slideForm.image}
                    alt="preview"
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                    onError={(e) => {
                      // eslint-disable-next-line no-param-reassign
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
              {slideForm.mobileImage && (
                <div
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 10px" }}>
                    Mobile preview
                  </div>
                  <img
                    src={slideForm.mobileImage}
                    alt="mobile preview"
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={slideForm.status}
                    onChange={(e) =>
                      setSlideForm((p) => ({ ...p, status: e.target.value }))
                    }
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input
                    className="form-input"
                    type="number"
                    value={slideForm.order}
                    onChange={(e) =>
                      setSlideForm((p) => ({ ...p, order: e.target.value }))
                    }
                    placeholder="1, 2, 3..."
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={addSlide}
              >
                Add Slide
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditModalOpen(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Edit Slide</div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setEditModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  value={editSlideForm.title}
                  onChange={(e) =>
                    setEditSlideForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. New Arrivals"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subtitle Line 1</label>
                <input
                  className="form-input"
                  value={editSlideForm.subtitleLine1}
                  onChange={(e) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      subtitleLine1: e.target.value,
                    }))
                  }
                  placeholder="e.g. New Arrivals"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subtitle Line 2</label>
                <input
                  className="form-input"
                  value={editSlideForm.subtitleLine2}
                  onChange={(e) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      subtitleLine2: e.target.value,
                    }))
                  }
                  placeholder="e.g. Drop 01"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subheading (optional)</label>
                <input
                  className="form-input"
                  value={editSlideForm.subheading}
                  onChange={(e) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      subheading: e.target.value,
                    }))
                  }
                  placeholder='e.g. Elegant Kurtis for Every You'
                />
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  margin: "16px 0 12px",
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 10,
                    fontSize: 14,
                  }}
                >
                  Text &amp; button colors (optional)
                </div>
                <ColorThemeField
                  label="Eyebrow label (title)"
                  value={editSlideForm.theme.tagColor}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, tagColor: v },
                    }))
                  }
                  hint="Small uppercase line next to the dash."
                />
                <ColorThemeField
                  label="Eyebrow dash / line"
                  value={editSlideForm.theme.tagLineColor}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, tagLineColor: v },
                    }))
                  }
                />
                <ColorThemeField
                  label="Headline line 1"
                  value={editSlideForm.theme.headline1Color}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, headline1Color: v },
                    }))
                  }
                />
                <ColorThemeField
                  label="Headline line 2"
                  value={editSlideForm.theme.headline2Color}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, headline2Color: v },
                    }))
                  }
                />
                <ColorThemeField
                  label="Subheading"
                  value={editSlideForm.theme.subheadingColor}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, subheadingColor: v },
                    }))
                  }
                />
                <ColorThemeField
                  label="Shop Now — button background"
                  value={editSlideForm.theme.buttonBg}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, buttonBg: v },
                    }))
                  }
                />
                <ColorThemeField
                  label="Shop Now — button text"
                  value={editSlideForm.theme.buttonText}
                  onChange={(v) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      theme: { ...p.theme, buttonText: v },
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Shop Now — link to category (optional)
                </label>
                <select
                  className="form-select"
                  value={editSlideForm.categoryId}
                  onChange={(e) =>
                    setEditSlideForm((p) => ({
                      ...p,
                      categoryId: e.target.value,
                    }))
                  }
                  disabled={categoriesLoading}
                >
                  <option value="">
                    {categoriesLoading
                      ? "Loading categories…"
                      : "All products (no filter)"}
                  </option>
                  {editCategorySelectRows.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.parentId != null ? `↳ ${c.title}` : c.title}
                    </option>
                  ))}
                </select>
                {categoriesError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--accent2)",
                      marginTop: 6,
                    }}
                  >
                    {categoriesError}{" "}
                    <button
                      type="button"
                      className="action-btn action-edit"
                      style={{ marginLeft: 8, fontSize: 11 }}
                      onClick={() => loadSlideCategories()}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Upload Image (optional)</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageFileChange}
                />
                {editUploading && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 6,
                    }}
                  >
                    Uploading image...
                  </div>
                )}
                {editUploadError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--accent2)",
                      marginTop: 6,
                    }}
                  >
                    {editUploadError}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Upload Mobile Image (optional)</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={handleEditMobileImageFileChange}
                />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  Uploaded mobile image is used only on phones (≤ 767px).
                </div>
              </div>

              {editSlideForm.image && (
                <div
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                  }}
                >
                  <img
                    src={editSlideForm.image}
                    alt="preview"
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              {editSlideForm.mobileImage && (
                <div
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 10px" }}>
                    Mobile preview
                  </div>
                  <img
                    src={editSlideForm.mobileImage}
                    alt="mobile preview"
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={editUploading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={editUploading || !editSlideId}
                onClick={saveEditSlide}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SlidesAdminSection;
