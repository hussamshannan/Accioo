// Import full-size images
const fullImages = import.meta.glob("../assets/images/*", { eager: true });

// Import compressed (small) images
const smallImages = import.meta.glob("../assets/images/small/*", {
  eager: true,
});

// Build an object with both versions
export const allImages = {};

for (const path in fullImages) {
  const fileName = path.split("/").pop(); // just filename, e.g. "photo.jpg"
  allImages[fileName] = {
    full: fullImages[path].default,
    small: smallImages[`../assets/images/small/${fileName}`]?.default, // fallback if not found
  };
}

// Helper function
export const getImage = (filename, type = "full") => {
  return allImages[filename]?.[type];
};
