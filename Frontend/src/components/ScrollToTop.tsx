import React, { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { shouldResetScroll } from '../utils/scrollReset';

/** Sang trang khác thì về đầu trang — quy tắc ở `utils/scrollReset.ts`. */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(pathname);

  // Layout effect: cuộn trước khi trình duyệt vẽ, không thấy trang mới nháy lên ở độ cuộn cũ.
  useLayoutEffect(() => {
    if (shouldResetScroll(previousPathname.current, pathname, navigationType)) {
      // index.css đặt `scroll-behavior: smooth` cho html. Tạm tắt để nhảy thẳng lên
      // đầu thay vì trượt cả trang dài trước mắt người dùng.
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      root.style.scrollBehavior = previousBehavior;
    }
    previousPathname.current = pathname;
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
