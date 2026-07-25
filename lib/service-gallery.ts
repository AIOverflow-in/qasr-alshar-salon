// Per-category image pools for the "single-image" service categories (hair
// styling/colour/treatment, glam, facials) so the booking flow can show a
// DIFFERENT picture for each service instead of repeating the one category image.
// Each pool = the category hero + a few on-service variants (public/services/).
// Categories with real work photos (braids, nails, henna…) aren't here — their
// services already get varied real photos via pickWorkPhoto.

export const CATEGORY_IMAGE_POOL: Record<string, string[]> = {
  "hair-styling": [
    "/services/svc-hair-styling.jpg",
    "/services/svc-hair-styling-1.jpg",
    "/services/svc-hair-styling-2.jpg",
    "/services/svc-hair-styling-3.jpg",
  ],
  "hairstyling-caucasian": [
    "/services/svc-hairstyling-caucasian.jpg",
    "/services/svc-hairstyling-caucasian-1.jpg",
    "/services/svc-hairstyling-caucasian-2.jpg",
    "/services/svc-hairstyling-caucasian-3.jpg",
  ],
  "hair-coloring": [
    "/services/svc-hair-coloring.jpg",
    "/services/svc-hair-coloring-1.jpg",
    "/services/svc-hair-coloring-2.jpg",
    "/services/svc-hair-coloring-3.jpg",
  ],
  "hair-treatment": [
    "/services/svc-hair-treatment.jpg",
    "/services/svc-hair-treatment-1.jpg",
    "/services/svc-hair-treatment-2.jpg",
    "/services/svc-hair-treatment-3.jpg",
  ],
  "qasr-glam": [
    "/services/svc-qasr-glam.jpg",
    "/services/svc-qasr-glam-1.jpg",
    "/services/svc-qasr-glam-2.jpg",
    "/services/svc-qasr-glam-3.jpg",
  ],
  facials: [
    "/services/svc-facial.jpg",
    "/services/svc-facial-1.jpg",
    "/services/svc-facial-2.jpg",
    "/services/svc-facial-3.jpg",
  ],
};
