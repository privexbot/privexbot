import { Button } from "@/components/ui/button";

interface BlogPost {
  id: number;
  category: string;
  categoryColor: string;
  title: string;
  author: string;
  authorAvatar: string;
  date: string;
  excerpt: string;
  image: string;
}

const blogPosts: BlogPost[] = [
  {
    id: 1,
    category: "AI Knowledge",
    categoryColor: "bg-[#4361EE]",
    title: "Understanding RAG: The Future of AI Knowledge Retrieval",
    author: "PrivexBot Team",
    authorAvatar: "/logo-green.png",
    date: "28th feb, 2026",
    excerpt: "Discover how Retrieval-Augmented Generation transforms AI chatbots by combining real-time knowledge with privacy-first architecture.",
    image: "/ourblog-image.png"
  },
  {
    id: 2,
    category: "Technical Deep Dive",
    categoryColor: "bg-[#4361EE]",
    title: "Chunking Strategies: Optimizing Knowledge Base Performance",
    author: "PrivexBot Team",
    authorAvatar: "/logo-green.png",
    date: "25th feb, 2026",
    excerpt: "Explore advanced chunking techniques that improve AI response accuracy while maintaining data privacy in trusted execution environments.",
    image: "/ourblog-image.png"
  },
  {
    id: 3,
    category: "Platform Guide",
    categoryColor: "bg-[#4361EE]",
    title: "How PrivexBot Works: Privacy-First AI for Everyone",
    author: "PrivexBot Team",
    authorAvatar: "/logo-green.png",
    date: "23rd feb, 2026",
    excerpt: "Learn how our Secret VM architecture ensures your data stays private while delivering powerful AI chatbot capabilities across multiple channels.",
    image: "/ourblog-image.png"
  }
];

export function OurBlog() {
  return (
    <section className="py-16 md:py-24 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 lg:mb-16">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-manrope">Our blog</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 lg:mb-0 font-manrope">
              Latest blog posts
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl font-manrope">
              Discover stories, tips, and resources to inspire your next big idea.
            </p>
          </div>

          {/* View all posts button - desktop only */}
          <div className="hidden lg:block">
            <Button className="bg-[#4361EE] hover:bg-[#3651d9] text-white px-6 py-3 rounded-xl font-manrope font-medium">
              View all posts
            </Button>
          </div>
        </div>

        {/* Blog posts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-8">
          {blogPosts.map((post) => (
            <article key={post.id} className="group cursor-pointer">
              {/* Blog post image */}
              <div className="relative mb-6 overflow-hidden rounded-2xl bg-gray-100">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Category badge */}
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-white text-sm font-medium font-manrope ${post.categoryColor}`}>
                  {post.category}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-4 font-manrope leading-tight group-hover:text-[#4361EE] transition-colors">
                {post.title}
              </h3>

              {/* Author and date */}
              <div className="flex items-center mb-4">
                <img
                  src={post.authorAvatar}
                  alt={post.author}
                  className="w-6 h-6 rounded-full mr-3"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  {post.author}
                </span>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  {post.date}
                </span>
              </div>

              {/* Excerpt */}
              <p className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                {post.excerpt}
              </p>
            </article>
          ))}
        </div>

        {/* View all posts button - mobile only */}
        <div className="lg:hidden mt-12 text-center">
          <Button className="w-full bg-[#4361EE] hover:bg-[#3651d9] text-white px-6 py-4 rounded-xl font-manrope font-medium text-lg">
            View all posts
          </Button>
        </div>
      </div>
    </section>
  );
}