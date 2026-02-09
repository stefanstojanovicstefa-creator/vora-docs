/**
 * VirtualList Component
 * Reusable virtualized list for rendering large datasets efficiently
 * Uses @tanstack/react-virtual for performance optimization
 */

import { useRef, forwardRef, CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Function to render each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Estimated size of each item in pixels */
  estimateSize?: number;
  /** Height of the scrollable container */
  height?: string | number;
  /** Maximum height of the scrollable container */
  maxHeight?: string | number;
  /** Gap between items in pixels */
  gap?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Overscan count - number of items to render outside viewport */
  overscan?: number;
  /** Key extractor function for items */
  getItemKey?: (item: T, index: number) => string;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Loading component */
  loadingComponent?: React.ReactNode;
  /** Empty state component */
  emptyComponent?: React.ReactNode;
}

function VirtualListInner<T>(
  {
    items,
    renderItem,
    estimateSize = 80,
    height = '100%',
    maxHeight,
    gap = 0,
    className,
    overscan = 5,
    getItemKey,
    isLoading = false,
    loadingComponent,
    emptyComponent,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => estimateSize,
      overscan,
      gap,
    });

    const virtualItems = virtualizer.getVirtualItems();

    // Loading state
    if (isLoading && loadingComponent) {
      return (
        <div
          ref={ref}
          className={cn('w-full', className)}
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            maxHeight: maxHeight
              ? typeof maxHeight === 'number'
                ? `${maxHeight}px`
                : maxHeight
              : undefined,
          }}
        >
          {loadingComponent}
        </div>
      );
    }

    // Empty state
    if (items.length === 0 && emptyComponent) {
      return (
        <div
          ref={ref}
          className={cn('w-full', className)}
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            maxHeight: maxHeight
              ? typeof maxHeight === 'number'
                ? `${maxHeight}px`
                : maxHeight
              : undefined,
          }}
        >
          {emptyComponent}
        </div>
      );
    }

    return (
      <div
        ref={parentRef}
        className={cn('w-full overflow-auto', className)}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          maxHeight: maxHeight
            ? typeof maxHeight === 'number'
              ? `${maxHeight}px`
              : maxHeight
            : undefined,
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            const key = getItemKey
              ? getItemKey(item, virtualRow.index)
              : virtualRow.key;

            return (
              <div
                key={key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderItem(item, virtualRow.index)}
              </div>
            );
          })}
        </div>
      </div>
    );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof VirtualListInner>;

/**
 * Hook for creating a virtualized list with dynamic sizing
 * Useful when item heights vary
 */
export function useVirtualList<T>({
  items,
  estimateSize = 80,
  overscan = 5,
  gap = 0,
}: {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  gap?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    gap,
  });

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}

/**
 * VirtualGrid Component
 * Reusable virtualized grid for rendering large datasets in a grid layout
 */

interface VirtualGridProps<T> {
  /** Array of items to render */
  items: T[];
  /** Function to render each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Number of columns */
  columns: number;
  /** Estimated height of each row in pixels */
  estimateRowHeight?: number;
  /** Height of the scrollable container */
  height?: string | number;
  /** Maximum height of the scrollable container */
  maxHeight?: string | number;
  /** Gap between items in pixels */
  gap?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Overscan count - number of rows to render outside viewport */
  overscan?: number;
  /** Key extractor function for items */
  getItemKey?: (item: T, index: number) => string;
}

export function VirtualGrid<T>({
  items,
  renderItem,
  columns,
  estimateRowHeight = 300,
  height = '100%',
  maxHeight,
  gap = 16,
  className,
  overscan = 2,
  getItemKey,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate rows from items
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn('w-full overflow-auto', className)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        maxHeight: maxHeight
          ? typeof maxHeight === 'number'
            ? `${maxHeight}px`
            : maxHeight
          : undefined,
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid items-stretch"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, colIndex) => {
                  const itemIndex = startIndex + colIndex;
                  const key = getItemKey
                    ? getItemKey(item, itemIndex)
                    : `${virtualRow.key}-${colIndex}`;

                  return (
                    <div key={key} className="h-full">
                      {renderItem(item, itemIndex)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
