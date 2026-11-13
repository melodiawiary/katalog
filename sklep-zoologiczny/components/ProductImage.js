export default function ProductImage({ product, emoji = '🐾' }) {
  if (product.image_url) {
    return <img src={product.image_url} alt={product.name} className="product-img" loading="lazy" />;
  }
  return (
    <div className="product-img placeholder" aria-hidden="true">
      {emoji}
    </div>
  );
}
