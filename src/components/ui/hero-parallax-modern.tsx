"use client";
import React, { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
  useMotionTemplate,
} from "motion/react";

export const HeroParallaxModern = ({
  products,
}: {
  products: {
    title: string;
    link: string;
    thumbnail: string;
  }[];
}) => {
  const firstRow = products.slice(0, 5);
  const secondRow = products.slice(5, 10);
  const thirdRow = products.slice(10, 15);
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const springConfig = { stiffness: 300, damping: 30, bounce: 100 };

  const translateX = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 1000]),
    springConfig,
  );
  const translateXReverse = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, -1000]),
    springConfig,
  );
  const rotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [15, 0]),
    springConfig,
  );
  const opacity = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [0.2, 1]),
    springConfig,
  );
  const rotateZ = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [20, 0]),
    springConfig,
  );
  const translateY = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [-700, 500]),
    springConfig,
  );

  // Mouse trail effect
  const mouseX = useSpring(0, { stiffness: 50, damping: 20 });
  const mouseY = useSpring(0, { stiffness: 50, damping: 20 });

  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className="h-[300vh] py-40 overflow-hidden antialiased relative flex flex-col self-auto perspective-[1000px] transform-3d bg-background transition-colors duration-500"
    >
      {/* Dynamic Mouse Effect Background */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100 dark:opacity-20 opacity-10"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(120,119,198,0.15),
              transparent 80%
            )
          `,
        }}
      />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      <Header />
      <motion.div
        style={{
          rotateX,
          rotateZ,
          translateY,
          opacity,
        }}
        className="relative z-10"
      >
        <motion.div className="flex flex-row-reverse space-x-reverse space-x-20 mb-20">
          {firstRow.map((product, i) => (
            <ProductCard
              product={product}
              translate={translateX}
              key={product.title}
              index={i}
            />
          ))}
        </motion.div>
        <motion.div className="flex flex-row mb-20 space-x-20">
          {secondRow.map((product, i) => (
            <ProductCard
              product={product}
              translate={translateXReverse}
              key={product.title}
              index={5 + i}
            />
          ))}
        </motion.div>
        <motion.div className="flex flex-row-reverse space-x-reverse space-x-20">
          {thirdRow.map((product, i) => (
            <ProductCard
              product={product}
              translate={translateX}
              key={product.title}
              index={10 + i}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export const Header = () => {
  return (
    <div className="max-w-7xl relative mx-auto py-20 md:py-40 px-4 w-full left-0 top-0 z-20">
      <div className="flex flex-col items-start justify-center">
        <div className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm px-3 py-1 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
          Plataforma ProOps
        </div>

        <h1 className="text-4xl md:text-8xl font-black dark:text-white tracking-tighter max-w-5xl leading-[1.1]">
          Gestão inteligente para{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 dark:to-blue-400">
            operações modernas
          </span>
        </h1>

        <p className="max-w-2xl text-lg md:text-2xl mt-8 text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">
          Tenha controle sobre propostas, CRM, financeiro, catálogo e equipe.
          Uma plataforma única para acelerar sua operação comercial.
        </p>

        <div className="mt-10 flex gap-4 flex-col sm:flex-row">
          <button className="px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-[0_0_40px_-10px_rgba(var(--primary),0.5)]">
            Começar Agora
          </button>
          <button className="px-8 py-4 rounded-full border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-800 dark:text-neutral-200 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
            Agendar Demonstração
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductCard = ({
  product,
  translate,
  index = 0,
}: {
  product: {
    title: string;
    link: string;
    thumbnail: string;
  };
  translate: MotionValue<number>;
  index?: number;
}) => {
  const isPriority = index < 5;

  return (
    <motion.div
      style={{
        x: translate,
      }}
      whileHover={{ y: -20, scale: 1.05 }}
      transition={{ duration: 0.2 }}
      key={product.title}
      className="group h-72 w-md relative shrink-0 rounded-2xl overflow-hidden border border-neutral-200/50 dark:border-white/10 bg-white/10 dark:bg-black/10 backdrop-blur-md shadow-2xl"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
      <div className="absolute bottom-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-4 group-hover:translate-y-0">
        <h2 className="text-white font-bold text-xl">{product.title}</h2>
      </div>
      <div className="block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.thumbnail}
          height="600"
          width="800"
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : "auto"}
          decoding={isPriority ? "sync" : "async"}
          className="object-cover absolute h-full w-full inset-0 rounded-xl"
          alt={product.title}
        />
      </div>
    </motion.div>
  );
};
