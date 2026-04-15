import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ListingCard from '@/components/ListingCard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ─── Test fixtures ────────────────────────────────────────────────────────────
const baseListing = {
  id: 'listing-001',
  title: '大安區精品套房，近捷運，高速 Wi-Fi',
  city: '台北市',
  district: '大安區',
  type: '套房',
  price: 25000,
  minRent: 3,
  wifiSpeed: 300,
  wifiVerified: true,
  hasDesk: true,
  foreignOk: false,
  images: ['https://example.com/photo.jpg'],
  avgRating: '4.8',
  reviewCount: 12,
  includedFees: ['水費', '網路'],
  availableFrom: null,
};

describe('ListingCard — 基本渲染', () => {
  it('顯示房源標題', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('大安區精品套房，近捷運，高速 Wi-Fi');
  });

  it('顯示區域與類型（在副標題段落中）', () => {
    render(<ListingCard listing={baseListing} />);
    const subText = screen.getByText(/大安區 · 套房/);
    expect(subText).toBeInTheDocument();
  });

  it('顯示城市標籤', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText('台北市')).toBeInTheDocument();
  });

  it('顯示 Wi-Fi 速度', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText(/300Mbps/)).toBeInTheDocument();
  });

  it('wifiVerified=true 顯示已驗證標章', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText(/listingCard\.verified/i)).toBeInTheDocument();
  });

  it('wifiVerified=false 不顯示驗證標章', () => {
    render(<ListingCard listing={{ ...baseListing, wifiVerified: false }} />);
    expect(screen.queryByText(/listingCard\.verified/i)).not.toBeInTheDocument();
  });

  it('顯示格式化價格', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText('NT$ 25,000')).toBeInTheDocument();
  });

  it('顯示評分', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('avgRating=null 不顯示評分', () => {
    render(<ListingCard listing={{ ...baseListing, avgRating: null }} />);
    expect(screen.queryByText('★')).not.toBeInTheDocument();
  });

  it('hasDesk=true 顯示工作桌標籤', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText(/listingCard\.hasDesk/i)).toBeInTheDocument();
  });

  it('hasDesk=false 不顯示工作桌標籤', () => {
    render(<ListingCard listing={{ ...baseListing, hasDesk: false }} />);
    expect(screen.queryByText(/listingCard\.hasDesk/i)).not.toBeInTheDocument();
  });

  it('foreignOk=true 顯示外籍友善標籤', () => {
    render(<ListingCard listing={{ ...baseListing, foreignOk: true }} />);
    expect(screen.getByText(/listingCard\.foreignOk/)).toBeInTheDocument();
  });

  it('foreignOk=false 不顯示外籍友善標籤', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.queryByText(/listingCard\.foreignOk/)).not.toBeInTheDocument();
  });

  it('includedFees 非空顯示費用包含', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText(/水費、網路/)).toBeInTheDocument();
  });

  it('includedFees 為空不顯示費用區塊', () => {
    render(<ListingCard listing={{ ...baseListing, includedFees: [] }} />);
    expect(screen.queryByText(/✓ 含/)).not.toBeInTheDocument();
  });

  it('availableFrom=null → 顯示立即可入住', () => {
    render(<ListingCard listing={{ ...baseListing, availableFrom: null }} />);
    expect(screen.getByText(/listingCard\.availableNow/)).toBeInTheDocument();
  });

  it('availableFrom 有值 → 顯示入住日期', () => {
    render(<ListingCard listing={{ ...baseListing, availableFrom: '2025-09-01' }} />);
    expect(screen.getByText(/listingCard\.availableFrom/)).toBeInTheDocument();
    expect(screen.queryByText(/listingCard\.availableNow/)).not.toBeInTheDocument();
  });

  it('Link 指向正確的 listing 詳情頁', () => {
    render(<ListingCard listing={baseListing} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/listings/listing-001');
  });

  it('圖片 alt 為房源標題', () => {
    render(<ListingCard listing={baseListing} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', '大安區精品套房，近捷運，高速 Wi-Fi');
  });

  it('圖片 src 使用 listing.images[0]', () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('images 陣列為空時使用 fallback 圖', () => {
    render(<ListingCard listing={{ ...baseListing, images: [] }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('unsplash');
  });
});

// ─── 收藏按鈕 ─────────────────────────────────────────────────────────────────
describe('ListingCard — 收藏功能', () => {
  it('showFavorite=false → 不顯示收藏按鈕', () => {
    render(<ListingCard listing={baseListing} showFavorite={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('showFavorite=true → 顯示收藏按鈕', () => {
    render(<ListingCard listing={baseListing} showFavorite={true} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('初始未收藏：aria-pressed=false', () => {
    render(<ListingCard listing={baseListing} showFavorite={true} initialFavorited={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('初始已收藏：aria-pressed=true', () => {
    render(<ListingCard listing={baseListing} showFavorite={true} initialFavorited={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('點擊後呼叫 /api/favorites POST 並更新狀態', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ favorited: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ListingCard listing={baseListing} showFavorite={true} initialFavorited={false} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/favorites', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ listingId: 'listing-001' }),
      }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('401 回應時重導向至登入頁', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', mockFetch);
    const mockHref = { href: '' };
    Object.defineProperty(window, 'location', { value: mockHref, writable: true });

    render(<ListingCard listing={baseListing} showFavorite={true} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await waitFor(() => expect(mockHref.href).toBe('/auth/login'));
  });

  it('onFavoriteChange callback 被呼叫並傳入正確值', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ favorited: true }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const onFavoriteChange = vi.fn();

    render(<ListingCard listing={baseListing} showFavorite={true} onFavoriteChange={onFavoriteChange} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(onFavoriteChange).toHaveBeenCalledWith(true);
    });
  });
});

// ─── Wi-Fi 速度標籤顏色 ────────────────────────────────────────────────────────
// Wi-Fi badge 格式："🔥 Wi-Fi 300Mbps" — 標題也含 Wi-Fi，所以用 /Mbps/ 查詢 badge
describe('ListingCard — Wi-Fi 速度標籤', () => {
  it('300 Mbps → 超高速 🔥', () => {
    render(<ListingCard listing={{ ...baseListing, wifiSpeed: 300 }} />);
    const wifiBadge = screen.getByText(/300Mbps/);
    expect(wifiBadge.textContent).toContain('🔥');
  });

  it('100 Mbps → 高速 ⚡', () => {
    render(<ListingCard listing={{ ...baseListing, wifiSpeed: 100 }} />);
    const wifiBadge = screen.getByText(/100Mbps/);
    expect(wifiBadge.textContent).toContain('⚡');
  });

  it('50 Mbps → 穩定 ✅', () => {
    render(<ListingCard listing={{ ...baseListing, wifiSpeed: 50 }} />);
    const wifiBadge = screen.getByText(/50Mbps/);
    expect(wifiBadge.textContent).toContain('✅');
  });

  it('10 Mbps → 基本 ⚠️', () => {
    render(<ListingCard listing={{ ...baseListing, wifiSpeed: 10 }} />);
    const wifiBadge = screen.getByText(/10Mbps/);
    expect(wifiBadge.textContent).toContain('⚠️');
  });

  it('Wi-Fi 速度數字正確顯示', () => {
    render(<ListingCard listing={{ ...baseListing, wifiSpeed: 150 }} />);
    expect(screen.getByText(/150Mbps/)).toBeInTheDocument();
  });
});
