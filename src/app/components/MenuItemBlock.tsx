import { motion } from 'motion/react';

export function MenuItemBlock({
  name,
  desc,
  price,
  allergens,
  allergensLabel,
  image,
}: {
  name: string;
  desc?: string;
  price: string;
  allergens?: string;
  allergensLabel?: string;
  image?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group"
    >
      <div className="flex gap-6">
        {image && (
          <div className="w-32 h-32 flex-shrink-0 overflow-hidden bg-black/5">
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        <div className="flex-1 flex justify-between items-start gap-4">
          <div className="flex-1">
            <h4 className="text-lg tracking-wide mb-2 uppercase">{name}</h4>
            {desc && <p className="text-sm text-black/60 font-light leading-relaxed mb-2">{desc}</p>}
            {allergens && allergensLabel && (
              <p className="text-xs text-black/40">
                {allergensLabel}: {allergens}
              </p>
            )}
          </div>
          <div className="text-lg tracking-wide whitespace-nowrap font-medium">{price}</div>
        </div>
      </div>
    </motion.div>
  );
}
