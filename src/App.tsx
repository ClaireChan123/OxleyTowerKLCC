import React, { useState, useEffect } from 'react';
import { 
  onSnapshot, 
  collection, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  MapPin, 
  Maximize2, 
  Zap, 
  Camera, 
  Phone, 
  Edit2, 
  Plus, 
  Trash2, 
  Link, 
  ZoomIn,
  ExternalLink,
  Upload,
  Loader2
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { 
  updateContent, 
  updateLayout, 
  deleteLayout, 
  updateGalleryImage, 
  deleteGalleryImage, 
  uploadImage,
  testConnection
} from './services/firebaseService';
import { convertUrlToFirebase } from './services/imageService';
import { cn } from './lib/utils';
// --- Types ---
interface ContentSection {
  id: string;
  sectionId: string;
  title: string;
  title_cn?: string;
  description: string;
  description_cn?: string;
  imageUrl?: string;
}

interface Layout {
  id: string;
  category: 'Jewel' | 'SO';
  unitType: string;
  unitType_cn?: string;
  size: string;
  psf: string;
  price: string;
  floorPlanUrl: string;
  virtualTourUrl?: string;
}

interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  caption_cn?: string;
  order: number;
}

const TRANSLATIONS = {
  en: {
    nav: {
      overview: 'Overview',
      location: 'Location',
      layouts: 'Layouts',
      gallery: 'Gallery',
      contact: 'Contact',
      admin: 'Admin',
      logout: 'Logout'
    },
    hero: {
      title: 'Oxley Tower KLCC',
      subtitle: 'Experience the Pinnacle of Luxury',
      enquire: 'Enquire Now'
    },
    overview: {
      jewel_badge: 'The Crown Jewel',
      so_badge: 'Fashionable Living',
      jewel_title: 'Jewel Residence: Rare & Radiant',
      jewel_desc: 'Jewel Residence is the epitome of sophisticated urban living, perched majestically above the world-renowned Langham Hotel. Residents enjoy a rare "Crown Jewel" status, with access to unparalleled hospitality services and bespoke amenities. Each home is a masterpiece of design, featuring floor-to-ceiling windows that frame the iconic KLCC skyline, premium marble finishes, and state-of-the-art smart home integration. Managed by the prestigious Pavilion Group, Jewel offers not just a home, but a legacy investment in the last piece of prime KLCC land.',
      so_title: 'SO/ Residences: Bold & Playful',
      so_desc: 'SO/ Residences brings a bold, fashion-forward energy to Kuala Lumpur, being the first-ever SO/ branded residences in the world. Designed for the trendsetters and the avant-garde, these homes blend high-fashion aesthetics with playful luxury. Residents benefit from the "Accor Ownership Benefit Programme", granting Diamond Tier status across the global Accor network. With signature services including a 24-hour concierge, private chef dining options, and access to the highest sky infinity pool in Malaysia, SO/ Residences is where lifestyle meets legend.',
      exclusive_units: 'Exclusive Units',
      starting_price: 'Starting Price',
      maintenance_fee: 'Maintenance Fee',
      management: 'Short-term Rental Management',
      luxury_units: 'Luxury Units',
      accor_benefit: 'Accor Ownership Benefit Programme for SO/ Owners',
      concierge: 'Dedicated Hotel Concierge Service Provided',
      jewel_price_val: 'RM 1.8M+',
      so_price_val: 'RM 1.5M+',
      maintenance_val: 'RM 0.60psf',
      management_val: 'Pavilion Group',
      accor_val: 'Diamond Tier',
      concierge_val: '24 Hours Concierge'
    },
    why: {
      badge: 'Exclusivity',
      title: 'Why Oxley Tower?',
      points: [
        { title: 'Freehold Ownership', desc: 'A rare and prestigious freehold title in the heart of KLCC, ensuring your investment remains a timeless asset for generations to come.' },
        { title: 'Highest Sky Infinity Pool', desc: 'Malaysia\'s highest infinity pool, offering an unobstructed, gravity-defying view of the Petronas Twin Towers.' },
        { title: 'Jewel: Pavilion Group Managed', desc: 'Operated by the prestigious Pavilion Group, allowing for lucrative short-term rentals and professional management.' },
        { title: '60,000 sqft Premium Retail', desc: 'Two storeys of curated luxury retail and world-class dining experiences right at your doorstep.' },
        { title: 'Fully Furnished Elegance', desc: 'Bespoke, move-in ready units fully furnished with designer pieces and high-end appliances.' },
        { title: 'The KLCC Epicenter', desc: 'Situated on the last piece of prime land in KLCC, offering unmatched connectivity and the city\'s most prestigious address.' }
      ]
    },
    location: {
      badge: 'The Address',
      title: 'At the Heart of Everything',
      desc: 'Perfectly positioned within the Golden Triangle, Oxley Tower KLCC offers unparalleled access to the city\'s finest shopping, dining, and cultural landmarks.',
      city: 'KLCC, Kuala Lumpur',
      points: [
        '300m to Suria KLCC', 
        '200m to KLCC Park', 
        '5 mins to Pavilion KL', 
        'Direct access to LRT & MRT',
        '1.8km to Prince Court Medical',
        '2.5km to Gleneagles Hospital',
        '2.0km to Sayfol International',
        '3.5km to ISKL'
      ]
    },
    layouts: {
      badge: 'Precision',
      title: 'Exquisite Layouts',
      no_layouts: 'No {tab} layouts added yet.',
      admin_hint: 'Click "Add Layout" to populate this section.',
      locked: 'Section Locked',
      add_layout: 'Add {tab} Layout',
      from: 'From'
    },
    gallery: {
      badge: 'Vision',
      title: 'The Gallery',
      bulk_upload: 'Bulk Upload',
      add_image: 'Add Image'
    },
    contact: {
      badge: 'Connect',
      title: 'Your Private Viewing Awaits',
      desc: 'Register your interest today for an exclusive tour of Oxley Tower KLCC.',
      whatsapp: 'WhatsApp Us',
      brochure: 'Download Brochure'
    },
    footer: {
      rights: 'All rights reserved.'
    },
    modals: {
      save: 'Save Changes',
      cancel: 'Cancel',
      uploading: 'Uploading...',
      start_upload: 'Start Upload',
      bulk_title: 'Bulk Upload Gallery',
      dropzone: 'Drag & drop multiple images here, or click to select',
      formats: 'Supports JPG, PNG, WEBP',
      uploading_count: 'Uploading {count} images...',
      virtual_tour: 'Virtual Tour',
      zoom_hint: 'Use mouse wheel or pinch to zoom • Drag to pan'
    }
  },
  cn: {
    nav: {
      overview: '项目概览',
      location: '地理位置',
      layouts: '户型设计',
      gallery: '实景图库',
      contact: '联系我们',
      admin: '管理员',
      logout: '退出登录'
    },
    hero: {
      title: 'Oxley Tower KLCC',
      subtitle: '体验极致奢华生活',
      enquire: '立即咨询'
    },
    overview: {
      jewel_badge: '皇冠上的明珠',
      so_badge: '时尚生活',
      jewel_title: 'Jewel Residence: 稀有且璀璨',
      jewel_desc: 'Jewel Residence 是精致都市生活的典范，雄踞于享誉全球的朗廷酒店 (Langham Hotel) 之上。业主享有稀有的“皇冠明珠”地位，可享受无与伦比的款待服务和定制设施。每一处住宅都是设计的杰作，拥有落地窗，完美框景标志性的 KLCC 天际线，配备顶级大理石饰面和最先进的智能家居集成。由著名的柏威年集团 (Pavilion Group) 管理，Jewel 不仅提供了一个家，更是对 KLCC 最后一块黄金地段的传承投资。',
      so_title: 'SO/ Residences: 大胆且俏皮',
      so_desc: 'SO/ Residences 为吉隆坡带来了大胆且时尚前卫的活力，是全球首个 SO/ 品牌住宅。专为潮流引领者和先锋人士设计，这些住宅将高级时尚美学与俏皮的奢华完美融合。业主可受益于“雅高所有权福利计划” (Accor Ownership Benefit Programme)，在全球雅高网络中享有钻石级会员地位。凭借包括 24 小时礼宾服务、私人厨师用餐选择以及进入马来西亚最高空中无边泳池的专属服务，SO/ Residences 是生活方式与传奇交汇之地。',
      exclusive_units: '尊贵单位',
      starting_price: '起售价',
      maintenance_fee: '管理费',
      management: '短期租赁管理',
      luxury_units: '豪华单位',
      accor_benefit: 'SO/ 业主享有的雅高所有权福利计划',
      concierge: '提供专属酒店礼宾服务',
      jewel_price_val: 'RM 180万+',
      so_price_val: 'RM 150万+',
      maintenance_val: 'RM 0.60/平方英尺',
      management_val: '柏威年集团',
      accor_val: '钻石级会员',
      concierge_val: '24小时礼宾服务'
    },
    why: {
      badge: '独特性',
      title: '为何选择 Oxley Tower?',
      points: [
        { title: '永久产权', desc: '位于 KLCC 核心地带的稀有且负盛名的永久产权，确保您的投资成为代代相传的永恒资产。' },
        { title: '最高空中无边际泳池', desc: '马来西亚最高的无边际泳池，提供直面双子塔的无遮挡震撼景观。' },
        { title: 'Jewel: 柏威年集团管理', desc: '由著名的柏威年集团 (Pavilion Group) 运营，可进行高收益的短期租赁和专业管理。' },
        { title: '60,000 平方英尺高端零售', desc: '两层精心策划的奢侈品零售和世界级餐饮体验，就在您的家门口。' },
        { title: '全家具优雅装潢', desc: '定制的、可随时入住的单位，配备名家设计的家具和高端家电。' },
        { title: 'KLCC 核心地带', desc: '坐落在 KLCC 最后一块黄金地段，提供无与伦比的连通性和城市最负盛名的地址。' }
      ]
    },
    location: {
      badge: '黄金地址',
      title: '核心地带，尽享繁华',
      desc: 'Oxley Tower KLCC 完美坐落在金三角地带，为您提供无与伦比的便捷，轻松抵达城市最顶级的购物、餐饮和文化地标。',
      city: '吉隆坡 KLCC',
      points: [
        '距离 Suria KLCC 300米', 
        '距离 KLCC 公园 200米', 
        '距离 Pavilion KL 5分钟', 
        '直达轻快铁 (LRT) 和地铁 (MRT)',
        '距离太子阁医疗中心 1.8公里',
        '距离鹰阁医院 2.5公里',
        '距离 Sayfol 国际学校 2.0公里',
        '距离 ISKL 国际学校 3.5公里'
      ]
    },
    layouts: {
      badge: '精工细作',
      title: '精致户型',
      no_layouts: '尚未添加 {tab} 户型。',
      admin_hint: '点击“添加户型”以填充此部分。',
      locked: '部分已锁定',
      add_layout: '添加 {tab} 户型',
      from: '起'
    },
    gallery: {
      badge: '视觉盛宴',
      title: '实景图库',
      bulk_upload: '批量上传',
      add_image: '添加图片'
    },
    contact: {
      badge: '联系我们',
      title: '您的私人预约已开启',
      desc: '立即注册，预约 Oxley Tower KLCC 的专属参观。',
      whatsapp: 'WhatsApp 咨询',
      brochure: '下载宣传册'
    },
    footer: {
      rights: '版权所有。'
    },
    modals: {
      save: '保存更改',
      cancel: '取消',
      uploading: '上传中...',
      start_upload: '开始上传',
      bulk_title: '批量上传图库',
      dropzone: '将多张图片拖放到此处，或点击选择',
      formats: '支持 JPG, PNG, WEBP 格式',
      uploading_count: '正在上传 {count} 张图片...',
      virtual_tour: '虚拟看房',
      zoom_hint: '使用鼠标滚轮或捏合缩放 • 拖动平移'
    }
  }
};

// --- Components ---

const Navbar = ({ 
  isAdmin, 
  onLogin, 
  onLogout, 
  lang, 
  setLang 
}: { 
  isAdmin: boolean, 
  onLogin: () => void, 
  onLogout: () => void,
  lang: 'en' | 'cn',
  setLang: (l: 'en' | 'cn') => void
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = TRANSLATIONS[lang].nav;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: t.overview, href: '#overview' },
    { name: t.location, href: '#location' },
    { name: t.layouts, href: '#layouts' },
    { name: t.gallery, href: '#gallery' },
    { name: t.contact, href: '#contact' },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 w-full z-50 transition-all duration-500",
      isScrolled ? "bg-black/80 backdrop-blur-md py-4 border-b border-white/10" : "bg-transparent py-6"
    )}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <a href="#" className="text-2xl font-serif tracking-widest text-white uppercase">
          Oxley <span className="font-light opacity-70">Tower</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className="text-xs uppercase tracking-widest text-white/70 hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}
          
          <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10">
            <button 
              onClick={() => setLang('en')}
              className={cn(
                "px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition-all",
                lang === 'en' ? "bg-white text-black" : "text-white/40 hover:text-white"
              )}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('cn')}
              className={cn(
                "px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition-all",
                lang === 'cn' ? "bg-white text-black" : "text-white/40 hover:text-white"
              )}
            >
              中文
            </button>
          </div>

          {isAdmin ? (
            <button onClick={onLogout} className="text-xs uppercase tracking-widest text-red-400 hover:text-red-300">{t.logout}</button>
          ) : (
            <button onClick={onLogin} className="text-xs uppercase tracking-widest text-white/40 hover:text-white/60">{t.admin}</button>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center space-x-4 md:hidden">
          <button 
            onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
            className="text-[10px] uppercase tracking-widest text-white/60 border border-white/20 px-2 py-1 rounded"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <button className="text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-black border-b border-white/10 py-8 md:hidden"
          >
            <div className="flex flex-col items-center space-y-6">
              {navLinks.map((link) => (
                <a 
                  key={link.name} 
                  href={link.href} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm uppercase tracking-widest text-white/70 hover:text-white"
                >
                  {link.name}
                </a>
              ))}
              {isAdmin ? (
                <button onClick={onLogout} className="text-sm uppercase tracking-widest text-red-400">{t.logout}</button>
              ) : (
                <button onClick={onLogin} className="text-sm uppercase tracking-widest text-white/40">{t.admin}</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const LayoutViewer = ({ layout, onClose, lang }: { layout: Layout | null, onClose: () => void, lang: 'en' | 'cn' }) => {
  if (!layout) return null;
  const t = TRANSLATIONS[lang].modals;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full h-full flex flex-col"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-serif text-white">
              {lang === 'cn' ? layout.unitType_cn || layout.unitType : layout.unitType}
            </h3>
            <p className="text-xs uppercase tracking-widest text-white/40">{layout.size} sq.ft. | RM {layout.price}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 bg-white/5 rounded-2xl overflow-hidden relative">
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
          >
            <TransformComponent wrapperClass="!w-full !h-full">
              <img 
                src={layout.floorPlanUrl} 
                alt={layout.unitType} 
                className="w-full h-full object-contain cursor-move"
                referrerPolicy="no-referrer"
              />
            </TransformComponent>
          </TransformWrapper>
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-white/60 pointer-events-none">
            {t.zoom_hint}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const BulkUploadModal = ({ 
  isOpen, 
  onClose, 
  onUploadComplete,
  currentGallerySize,
  lang
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onUploadComplete: () => void,
  currentGallerySize: number,
  lang: 'en' | 'cn'
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const t = TRANSLATIONS[lang].modals;

  const onDrop = (acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        alert(`File ${file.name} is too large (max 20MB)`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] as string[] }
  } as any);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);

    try {
      let completedCount = 0;
      const totalFiles = files.length;
      
      // Process in chunks of 2 to avoid overwhelming the connection
      const chunkSize = 2;
      for (let i = 0; i < totalFiles; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (file) => {
          try {
            const url = await uploadImage(file, 'gallery');
            const id = `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await updateGalleryImage(id, {
              id,
              url,
              caption: '',
              order: currentGallerySize + completedCount
            });
          } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
          } finally {
            completedCount++;
            setProgress(Math.round((completedCount / totalFiles) * 100));
          }
        }));
        // Small delay between chunks to let the network breathe
        if (i + chunkSize < totalFiles) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setFiles([]);
      onUploadComplete();
      onClose();
    } catch (err) {
      console.error("Bulk upload encountered an error:", err);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 p-8 rounded-2xl w-full max-w-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-serif text-white">{t.bulk_title}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" disabled={uploading}><X size={20} /></button>
        </div>

        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer mb-6",
            isDragActive ? "border-white bg-white/5" : "border-white/10 hover:border-white/30",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} disabled={uploading} />
          <Upload size={40} className="text-white/20 mb-4" />
          <p className="text-sm text-white/60">{t.dropzone}</p>
          <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest">{t.formats}</p>
        </div>

        {files.length > 0 && (
          <div className="mb-6 max-h-40 overflow-y-auto space-y-2 pr-2">
            {files.map((file, i) => (
              <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-xs text-white/70 truncate max-w-[200px]">{file.name}</span>
                <button 
                  onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-300"
                  disabled={uploading}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
              <span>{t.uploading_count.replace('{count}', files.length.toString())}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
              <motion.div 
                className="bg-white h-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button 
            onClick={onClose} 
            className="px-6 py-2 text-sm uppercase tracking-widest text-white/50 hover:text-white"
            disabled={uploading}
          >
            {t.cancel}
          </button>
          <button 
            onClick={handleUpload} 
            disabled={files.length === 0 || uploading}
            className="px-8 py-3 bg-white text-black text-xs uppercase tracking-widest font-bold rounded-full hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t.uploading}</span>
              </>
            ) : (
              <span>{t.start_upload} ({files.length})</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EditModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onSave,
  lang,
  isSaving = false
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  title: string, 
  children: React.ReactNode,
  onSave: () => void,
  lang: 'en' | 'cn',
  isSaving?: boolean
}) => {
  if (!isOpen) return null;
  const t = TRANSLATIONS[lang].modals;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 p-8 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-serif text-white">{title}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" disabled={isSaving}><X size={20} /></button>
        </div>
        <div className="space-y-4">
          {children}
        </div>
        <div className="mt-8 flex justify-end space-x-4">
          <button onClick={onClose} className="px-6 py-2 text-sm uppercase tracking-widest text-white/50 hover:text-white" disabled={isSaving}>{t.cancel}</button>
          <button 
            onClick={onSave} 
            disabled={isSaving}
            className="px-6 py-2 bg-white text-black text-sm uppercase tracking-widest font-bold rounded-full hover:bg-zinc-200 disabled:opacity-50 flex items-center space-x-2"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <span>{isSaving ? 'Processing...' : t.save}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ImageField = ({ 
  label, 
  currentUrl, 
  onChange,
  onConvertingChange 
}: { 
  label: string, 
  currentUrl?: string, 
  onChange: (url: string) => void,
  onConvertingChange?: (converting: boolean) => void
}) => {
  const [error, setError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    onConvertingChange?.(isUploading);
  }, [isUploading]);

  const convertToFirebase = async (url: string) => {
    if (!url || url.includes('firebasestorage.googleapis.com') || !url.startsWith('http')) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError(false);
    try {
      const newUrl = await convertUrlToFirebase(url, 'uploads');
      if (newUrl !== url) {
        onChange(newUrl);
      }
    } catch (err) {
      console.error("Conversion failed:", err);
      setError(true);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError(false);
    
    try {
      // Use a custom promise to track progress locally in this component
      const storageRef = ref(storage, `uploads/${Date.now()}_${acceptedFiles[0].name}`);
      const uploadTask = uploadBytesResumable(storageRef, acceptedFiles[0]);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (err) => {
          throw err;
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onChange(url);
          setIsUploading(false);
        }
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Upload failed. Please try a different image.");
      setError(true);
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] as string[] },
    multiple: false
  } as any);

  useEffect(() => {
    setError(false);
  }, [currentUrl]);

  const isExternal = currentUrl && !currentUrl.includes('firebasestorage.googleapis.com') && currentUrl.startsWith('http');

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-between items-center">
        <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</label>
        {isExternal && (
          <span className="text-[8px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded font-bold animate-pulse">External Link Detected</span>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {/* Primary Option: Upload */}
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer relative overflow-hidden",
            isDragActive ? "border-white bg-white/10" : "border-white/10 bg-white/5 hover:border-white/10 hover:border-white/30",
            isUploading && "opacity-80 pointer-events-none"
          )}
        >
          <input {...getInputProps()} />
          
          {isUploading && (
            <motion.div 
              className="absolute bottom-0 left-0 h-1 bg-white/30"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          )}

          {isUploading ? (
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="animate-spin text-white" size={32} />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-white font-bold">{uploadProgress}% Uploaded</p>
                <p className="text-[8px] text-white/40 mt-1">Direct upload to storage</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
                <Upload size={24} className="text-white" />
              </div>
              <p className="text-sm text-white font-medium mb-1">Upload from PC</p>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">High Speed & Compatibility</p>
            </>
          )}
        </div>

        {/* Secondary: URL */}
        <div className="space-y-2">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Or paste direct image URL (e.g. .jpg, .png)"
              value={currentUrl || ''} 
              onChange={e => onChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-24 py-3 text-white text-xs focus:outline-none focus:border-white/30 transition-colors"
            />
            <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            {isExternal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  convertToFirebase(currentUrl!);
                }}
                disabled={isUploading}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-orange-600 rounded-md hover:bg-orange-500 text-[9px] text-white font-bold uppercase tracking-widest transition-all shadow-lg"
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : 'Repair Link'}
              </button>
            )}
          </div>
          <p className="text-[9px] text-white/20 italic ml-1">
            Note: "Postimage" links are not direct images. Use the "Upload" box above for 100% success.
          </p>
        </div>
      </div>

      {currentUrl && (
        <div className="mt-2 relative group rounded-lg overflow-hidden border border-white/10 bg-white/5">
          {isUploading && (
            <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
              <Loader2 size={32} className="text-white animate-spin" />
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-white">
                  {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Uploading...'}
                </p>
                <p className="text-[10px] text-white/60">Sending file to storage</p>
              </div>
            </div>
          )}
          
          <img 
            src={currentUrl} 
            alt="Preview" 
            onError={() => {
              if (!isUploading) setError(true);
            }}
            className={cn(
              "w-full h-48 md:h-64 object-contain transition-all",
              (error || isUploading) && "opacity-20 grayscale scale-95"
            )}
            referrerPolicy="no-referrer"
          />

          {error && !isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 p-6 bg-red-500/10 backdrop-blur-[2px]">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mb-2">
                <X size={24} />
              </div>
              <div className="text-center max-w-[200px]">
                <p className="text-sm font-serif text-red-400">Broken Link Detected</p>
                <p className="text-[10px] text-white/40 leading-relaxed mt-1">This URL is not a direct image and will fail on mobile devices.</p>
              </div>
              <button 
                onClick={() => convertToFirebase(currentUrl!)}
                className="px-6 py-2 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg"
              >
                Auto-Repair Link
              </button>
            </div>
          )}
          
          {!error && !isUploading && isExternal && (
            <div className="absolute top-2 right-2 flex space-x-2">
              <span className="bg-yellow-500/20 text-yellow-300 text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-full backdrop-blur-md border border-yellow-500/20">
                Action Required: Save for iPad
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lang, setLang] = useState<'en' | 'cn'>('en');
  const [content, setContent] = useState<Record<string, ContentSection>>({});
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [activeLayoutTab, setActiveLayoutTab] = useState<'Jewel' | 'SO'>('SO');
  const [loading, setLoading] = useState(true);

  const t = TRANSLATIONS[lang];

  // Edit States
  const [editingSection, setEditingSection] = useState<ContentSection | null>(null);
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null);
  const [editingGallery, setEditingGallery] = useState<GalleryImage | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const [migrationStatus, setMigrationStatus] = useState({ 
    migrating: false,
    total: 0,
    current: 0
  });

  useEffect(() => {
    testConnection();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === 'clairee0726@gmail.com');
    });

    const unsubscribeContent = onSnapshot(collection(db, 'content'), (snapshot) => {
      const data: Record<string, ContentSection> = {};
      snapshot.docs.forEach(doc => {
        const item = { id: doc.id, ...doc.data() } as ContentSection;
        data[item.sectionId] = item;
      });
      setContent(data);
    });

    const unsubscribeLayouts = onSnapshot(collection(db, 'layouts'), (snapshot) => {
      setLayouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Layout)));
    });

    const unsubscribeGallery = onSnapshot(query(collection(db, 'gallery'), orderBy('order')), (snapshot) => {
      setGallery(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GalleryImage)));
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeContent();
      unsubscribeLayouts();
      unsubscribeGallery();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => signOut(auth);

  const saveSection = async () => {
    if (!editingSection) return;
    const id = editingSection.id || editingSection.sectionId;
    const data = { ...editingSection, id };
    await updateContent(id, data);
    setEditingSection(null);
  };

  const saveLayout = async () => {
    if (!editingLayout) return;
    const id = editingLayout.id || `layout_${Date.now()}`;
    const data = { ...editingLayout, id };
    await updateLayout(id, data);
    setEditingLayout(null);
  };

  const saveGallery = async () => {
    if (!editingGallery) return;
    const id = editingGallery.id || `gallery_${Date.now()}`;
    const data = { ...editingGallery, id };
    await updateGalleryImage(id, data);
    setEditingGallery(null);
  };

  const getSection = (sectionId: string, defaultTitle: string, defaultDesc: string) => {
    return content[sectionId] || { sectionId, title: defaultTitle, description: defaultDesc };
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white font-sans selection:bg-white selection:text-black">
      <Navbar 
        isAdmin={isAdmin} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        lang={lang}
        setLang={setLang}
      />

      {/* --- Hero Section --- */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2 }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={getSection('hero', '', '').imageUrl || "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&q=80&w=2000"} 
            alt="KL Skyline" 
            className="w-full h-full object-cover object-top md:object-[center_15%]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black"></div>
        </motion.div>

        <div className="relative z-10 text-center px-6 max-w-4xl">
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.5em] mb-6 text-white/70"
          >
            {t.hero.subtitle}
          </motion.p>
          <motion.h1 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-4xl sm:text-6xl md:text-8xl font-serif mb-8 leading-tight"
          >
            {lang === 'cn' 
              ? getSection('hero', t.hero.title, '').title_cn || t.hero.title 
              : getSection('hero', t.hero.title, '').title}
          </motion.h1>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <a href="#contact" className="inline-block px-10 py-4 bg-white text-black text-xs uppercase tracking-widest font-bold rounded-full hover:bg-zinc-200 transition-all transform hover:scale-105">
              {t.hero.enquire}
            </a>
          </motion.div>
        </div>

        {isAdmin && (
          <button 
            onClick={() => setEditingSection(getSection('hero', t.hero.title, ''))}
            className="absolute bottom-10 right-10 p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all"
          >
            <Edit2 size={20} />
          </button>
        )}
      </section>

      {/* --- Overview Section --- */}
      <section id="overview" className="py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          {/* SO/ Residences */}
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-[4/5] rounded-2xl overflow-hidden group order-2 md:order-1"
            >
              <img 
                src={getSection('overview_so_v2', '', '').imageUrl || "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1000"} 
                alt="SO/ Residences" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8 order-1 md:order-2"
            >
              <div className="space-y-4">
                <span className="text-xs uppercase tracking-widest text-white/40">{t.overview.so_badge}</span>
                <h2 className="text-4xl md:text-5xl font-serif">
                  {lang === 'cn' 
                    ? getSection('overview_so_v2', t.overview.so_title, '').title_cn || t.overview.so_title 
                    : getSection('overview_so_v2', t.overview.so_title, '').title}
                </h2>
              </div>
              <p className="text-lg text-white/60 leading-relaxed font-light whitespace-pre-wrap">
                {lang === 'cn' 
                  ? getSection('overview_so_v2', '', t.overview.so_desc).description_cn || t.overview.so_desc 
                  : getSection('overview_so_v2', '', t.overview.so_desc).description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-white/10">
                <div>
                  <p className="text-2xl font-serif mb-1">590</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.luxury_units}</p>
                </div>
                <div>
                  <p className="text-2xl font-serif mb-1">{t.overview.so_price_val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.starting_price}</p>
                </div>
                <div>
                  <p className="text-2xl font-serif mb-1">{t.overview.accor_val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.accor_benefit}</p>
                </div>
                <div>
                  <p className="text-2xl font-serif mb-1">{t.overview.concierge_val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.concierge}</p>
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setEditingSection(getSection('overview_so_v2', t.overview.so_title, t.overview.so_desc))}
                  className="p-3 bg-white/10 rounded-full hover:bg-white/20"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </motion.div>
          </div>

          {/* Jewel Residence */}
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <span className="text-xs uppercase tracking-widest text-white/40">{t.overview.jewel_badge}</span>
                <h2 className="text-4xl md:text-5xl font-serif">
                  {lang === 'cn' 
                    ? getSection('overview_jewel_v2', t.overview.jewel_title, '').title_cn || t.overview.jewel_title 
                    : getSection('overview_jewel_v2', t.overview.jewel_title, '').title}
                </h2>
              </div>
              <p className="text-lg text-white/60 leading-relaxed font-light whitespace-pre-wrap">
                {lang === 'cn' 
                  ? getSection('overview_jewel_v2', '', t.overview.jewel_desc).description_cn || t.overview.jewel_desc 
                  : getSection('overview_jewel_v2', '', t.overview.jewel_desc).description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-white/10">
                <div>
                  <p className="text-2xl font-serif mb-1">267</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.exclusive_units}</p>
                </div>
                <div>
                  <p className="text-2xl font-serif mb-1">{t.overview.jewel_price_val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.starting_price}</p>
                </div>
                <div>
                  <p className="text-2xl font-serif mb-1">{t.overview.maintenance_val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.maintenance_fee}</p>
                </div>
                <div>
                  <p className="text-2xl font-serif mb-1">{t.overview.management_val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{t.overview.management}</p>
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setEditingSection(getSection('overview_jewel_v2', t.overview.jewel_title, t.overview.jewel_desc))}
                  className="p-3 bg-white/10 rounded-full hover:bg-white/20"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-[4/5] rounded-2xl overflow-hidden group"
            >
              <img 
                src={getSection('overview_jewel_v2', '', '').imageUrl || "https://images.unsplash.com/photo-1600607687940-c52af036999b?auto=format&fit=crop&q=80&w=1000"} 
                alt="Jewel Residence" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- Why Oxley --- */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <span className="text-xs uppercase tracking-widest text-white/40">{t.why.badge}</span>
            <h2 className="text-4xl md:text-5xl font-serif">{t.why.title}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.why.points.map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-10 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors group"
              >
                <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {[<Zap />, <Maximize2 />, <Phone />, <Plus />, <Camera />, <MapPin />][i]}
                </div>
                <h3 className="text-xl font-serif mb-4">{item.title}</h3>
                <p className="text-white/50 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Location --- */}
      <section id="location" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col space-y-16">
            <div className="grid lg:grid-cols-2 gap-12 items-end">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-white/40">{t.location.badge}</span>
                    {isAdmin && (
                      <button 
                        onClick={() => setEditingSection(getSection('location', t.location.title, t.location.desc))}
                        className="p-2 bg-white/5 rounded-full hover:bg-white/10 lg:hidden"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                  <h2 className="text-4xl md:text-5xl font-serif">
                    {lang === 'cn' 
                      ? getSection('location', t.location.title, '').title_cn || t.location.title 
                      : getSection('location', t.location.title, '').title}
                  </h2>
                </div>
                <p className="text-lg text-white/60 leading-relaxed font-light whitespace-pre-wrap max-w-2xl">
                  {lang === 'cn' 
                    ? getSection('location', '', t.location.desc).description_cn || t.location.desc 
                    : getSection('location', '', t.location.desc).description}
                </p>
              </div>
              <div className="space-y-6">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {t.location.points.map((item, i) => (
                    <li key={i} className="flex items-center space-x-3 text-white/70">
                      <ChevronRight size={14} className="text-white/30 shrink-0" />
                      <span className="text-[10px] uppercase tracking-widest leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
                {isAdmin && (
                  <button 
                    onClick={() => setEditingSection(getSection('location', t.location.title, t.location.desc))}
                    className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-white/5 rounded-full hover:bg-white/10 text-[10px] uppercase tracking-widest text-white/40 transition-colors"
                  >
                    <Edit2 size={12} />
                    <span>Edit Location Content</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative h-[400px] md:h-[700px] rounded-3xl overflow-hidden group shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] border border-white/5">
              <img 
                src={getSection('location', '', '').imageUrl || "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&q=80&w=1000"} 
                alt="Location Map" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              {isAdmin && (
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingSection(getSection('location', t.location.title, t.location.desc))}
                    className="p-4 bg-black/50 backdrop-blur-md rounded-full hover:bg-black/70 border border-white/10"
                  >
                    <Edit2 size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* --- Layouts Section --- */}
      <section id="layouts" className="py-20 bg-zinc-950 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-white/40">{t.layouts.badge}</span>
              <h2 className="text-4xl md:text-5xl font-serif">{t.layouts.title}</h2>
              <div className="flex space-x-6 pt-4 overflow-x-auto pb-2 scrollbar-hide">
                {['SO', 'Jewel'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveLayoutTab(tab as any)}
                    className={cn(
                      "text-xs uppercase tracking-[0.3em] pb-2 border-b transition-all whitespace-nowrap",
                      activeLayoutTab === tab ? "text-white border-white" : "text-white/30 border-transparent hover:text-white/60"
                    )}
                  >
                    {tab === 'Jewel' ? 'Jewel Residence' : 'SO/ Residences'}
                  </button>
                ))}
              </div>
            </div>
            {isAdmin && activeLayoutTab !== 'SO' && (
              <button 
                onClick={() => setEditingLayout({ id: '', category: activeLayoutTab, unitType: '', size: '', psf: '', price: '', floorPlanUrl: '' })}
                className="flex items-center space-x-2 px-6 py-3 bg-white text-black text-xs uppercase tracking-widest font-bold rounded-full hover:bg-zinc-200"
              >
                <Plus size={16} />
                <span>{t.layouts.add_layout.replace('{tab}', activeLayoutTab)}</span>
              </button>
            )}
            {activeLayoutTab === 'SO' && (
              <div className="flex items-center space-x-2 px-6 py-3 bg-white/5 text-white/30 text-xs uppercase tracking-widest font-bold rounded-full border border-white/10 cursor-not-allowed">
                <span>{t.layouts.locked}</span>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {layouts
              .filter(l => l.category === activeLayoutTab)
              .map((layout) => (
              <motion.div 
                key={layout.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group"
              >
                <div 
                  className="aspect-square relative overflow-hidden bg-white/10 cursor-pointer group"
                  onClick={() => setSelectedLayout(layout)}
                >
                  <img 
                    src={layout.floorPlanUrl} 
                    alt={layout.unitType} 
                    className="w-full h-full object-contain p-8 transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white">
                      <ZoomIn size={24} />
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    {isAdmin && layout.category !== 'SO' && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingLayout(layout); }} className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20"><Edit2 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteLayout(layout.id); }} className="p-2 bg-red-500/20 backdrop-blur-md rounded-full hover:bg-red-500/40 text-red-400"><Trash2 size={16} /></button>
                      </>
                    )}
                    {layout.category === 'SO' && (
                      <div className="p-2 bg-white/5 backdrop-blur-md rounded-full text-white/30" title="This section is locked">
                        <Maximize2 size={16} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-serif mb-1">
                        {lang === 'cn' ? layout.unitType_cn || layout.unitType : layout.unitType}
                      </h3>
                      <p className="text-xs uppercase tracking-widest text-white/40">{layout.size} sq.ft.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-serif text-white">RM {layout.price}</p>
                      <p className="text-[10px] uppercase tracking-widest text-white/30">{t.layouts.from} RM {layout.psf} psf</p>
                    </div>
                  </div>
                  {layout.virtualTourUrl && (
                    <a 
                      href={layout.virtualTourUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 w-full py-3 border border-white/10 rounded-full text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                    >
                      <ExternalLink size={14} />
                      <span>{t.modals.virtual_tour}</span>
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Gallery --- */}
      <section id="gallery" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-20">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-white/40">{t.gallery.badge}</span>
              <h2 className="text-4xl md:text-5xl font-serif">{t.gallery.title}</h2>
            </div>
            {isAdmin && (
              <div className="flex space-x-4">
                <button 
                  onClick={() => setIsBulkUploading(true)}
                  className="flex items-center space-x-2 px-6 py-3 border border-white/10 text-white text-xs uppercase tracking-widest font-bold rounded-full hover:bg-white/5"
                >
                  <Upload size={16} />
                  <span>{t.gallery.bulk_upload}</span>
                </button>
                <button 
                  onClick={() => setEditingGallery({ id: '', url: '', order: gallery.length })}
                  className="flex items-center space-x-2 px-6 py-3 bg-white text-black text-xs uppercase tracking-widest font-bold rounded-full hover:bg-zinc-200"
                >
                  <Plus size={16} />
                  <span>{t.gallery.add_image}</span>
                </button>
              </div>
            )}
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {gallery.map((img) => (
              <motion.div 
                key={img.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="relative rounded-2xl overflow-hidden group"
              >
                <img 
                  src={img.url} 
                  alt={lang === 'cn' ? img.caption_cn || img.caption || "Gallery" : img.caption || "Gallery"} 
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8">
                  <p className="text-sm font-serif italic mb-4">
                    {lang === 'cn' ? img.caption_cn || img.caption : img.caption}
                  </p>
                  {isAdmin && (
                    <div className="flex space-x-2">
                      <button onClick={() => setEditingGallery(img)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><Edit2 size={14} /></button>
                      <button onClick={() => deleteGalleryImage(img.id)} className="p-2 bg-red-500/20 rounded-full hover:bg-red-500/40 text-red-400"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Contact --- */}
      <section id="contact" className="py-20 bg-zinc-950 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-widest text-white/40">{t.contact.badge}</span>
            <h2 className="text-4xl md:text-6xl font-serif">{t.contact.title}</h2>
            <p className="text-white/50 text-lg font-light">{t.contact.desc}</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <a 
              href="https://wa.link/tvtk3l" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full md:w-auto flex items-center justify-center space-x-3 px-10 py-5 bg-[#25D366] text-white rounded-full hover:scale-105 transition-transform"
            >
              <Phone size={20} />
              <span className="text-sm uppercase tracking-widest font-bold">{t.contact.whatsapp}</span>
            </a>
            <a 
              href="https://wa.link/4eced0"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto px-10 py-5 border border-white/10 rounded-full text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all text-center flex items-center justify-center"
            >
              {t.contact.brochure}
            </a>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="text-center md:text-left">
            <p className="text-xl font-serif tracking-widest uppercase mb-2">Oxley Tower</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">© {new Date().getFullYear()} Oxley Holdings Limited. {t.footer.rights}</p>
          </div>
          <div className="flex space-x-8 text-[10px] uppercase tracking-widest text-white/40">
            <a href="#" className="hover:text-white">{lang === 'cn' ? '隐私政策' : 'Privacy Policy'}</a>
            <a href="#" className="hover:text-white">{lang === 'cn' ? '使用条款' : 'Terms of Use'}</a>
            <a href="#" className="hover:text-white">{lang === 'cn' ? '免责声明' : 'Disclaimer'}</a>
          </div>
        </div>
      </footer>

      {/* --- Modals --- */}
      <EditModal 
        isOpen={!!editingSection} 
        onClose={() => setEditingSection(null)} 
        title="Edit Section"
        onSave={saveSection}
        lang={lang}
        isSaving={isConverting}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-white/50">Title (English)</label>
              <input 
                type="text" 
                value={editingSection?.title || ''} 
                onChange={e => setEditingSection(prev => ({ ...prev!, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-white/50">Title (Chinese)</label>
              <input 
                type="text" 
                value={editingSection?.title_cn || ''} 
                onChange={e => setEditingSection(prev => ({ ...prev!, title_cn: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Description (English)</label>
            <textarea 
              rows={4}
              value={editingSection?.description || ''} 
              onChange={e => setEditingSection(prev => ({ ...prev!, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Description (Chinese)</label>
            <textarea 
              rows={4}
              value={editingSection?.description_cn || ''} 
              onChange={e => setEditingSection(prev => ({ ...prev!, description_cn: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <ImageField 
            label="Section Image" 
            currentUrl={editingSection?.imageUrl} 
            onChange={url => setEditingSection(prev => ({ ...prev!, imageUrl: url }))} 
            onConvertingChange={setIsConverting}
          />
        </div>
      </EditModal>

      <EditModal 
        isOpen={!!editingLayout} 
        onClose={() => setEditingLayout(null)} 
        title="Edit Layout"
        onSave={saveLayout}
        lang={lang}
        isSaving={isConverting}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Unit Type (English)</label>
            <input 
              type="text" 
              value={editingLayout?.unitType || ''} 
              onChange={e => setEditingLayout(prev => ({ ...prev!, unitType: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Unit Type (Chinese)</label>
            <input 
              type="text" 
              value={editingLayout?.unitType_cn || ''} 
              onChange={e => setEditingLayout(prev => ({ ...prev!, unitType_cn: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Size (sq.ft.)</label>
            <input 
              type="text" 
              value={editingLayout?.size || ''} 
              onChange={e => setEditingLayout(prev => ({ ...prev!, size: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Price (RM)</label>
            <input 
              type="text" 
              value={editingLayout?.price || ''} 
              onChange={e => setEditingLayout(prev => ({ ...prev!, price: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">PSF (RM)</label>
            <input 
              type="text" 
              value={editingLayout?.psf || ''} 
              onChange={e => setEditingLayout(prev => ({ ...prev!, psf: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-white/50">Virtual Tour URL</label>
          <input 
            type="text" 
            value={editingLayout?.virtualTourUrl || ''} 
            onChange={e => setEditingLayout(prev => ({ ...prev!, virtualTourUrl: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
          />
        </div>
        <ImageField 
          label="Floor Plan Image" 
          currentUrl={editingLayout?.floorPlanUrl} 
          onChange={url => setEditingLayout(prev => ({ ...prev!, floorPlanUrl: url }))} 
          onConvertingChange={setIsConverting}
        />
      </EditModal>

      <EditModal 
        isOpen={!!editingGallery} 
        onClose={() => setEditingGallery(null)} 
        title="Edit Gallery Image"
        onSave={saveGallery}
        lang={lang}
        isSaving={isConverting}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-white/50">Caption (English)</label>
              <input 
                type="text" 
                value={editingGallery?.caption || ''} 
                onChange={e => setEditingGallery(prev => ({ ...prev!, caption: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-white/50">Caption (Chinese)</label>
              <input 
                type="text" 
                value={editingGallery?.caption_cn || ''} 
                onChange={e => setEditingGallery(prev => ({ ...prev!, caption_cn: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Order</label>
            <input 
              type="number" 
              value={editingGallery?.order || 0} 
              onChange={e => setEditingGallery(prev => ({ ...prev!, order: parseInt(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <ImageField 
            label="Gallery Image" 
            currentUrl={editingGallery?.url} 
            onChange={url => setEditingGallery(prev => ({ ...prev!, url: url }))} 
            onConvertingChange={setIsConverting}
          />
        </div>
      </EditModal>

      <BulkUploadModal 
        isOpen={isBulkUploading} 
        onClose={() => setIsBulkUploading(false)} 
        onUploadComplete={() => {}} 
        currentGallerySize={gallery.length} 
        lang={lang}
      />

      <LayoutViewer 
        layout={selectedLayout} 
        onClose={() => setSelectedLayout(null)} 
        lang={lang}
      />
    </div>
  );
}
