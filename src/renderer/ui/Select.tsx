import { useEffect, useMemo, useRef, useState } from 'react';
import { providerIcons, providerMetas } from '@/providers';

export function Select(props: {
  modelValue: string;
  loading?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);

  const selectedProvider = useMemo(() => {
    return providerMetas.find((provider) => provider.key === props.modelValue) ?? providerMetas[0];
  }, [props.modelValue]);

  const selectedIcon = providerIcons[props.modelValue as keyof typeof providerIcons];

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!selectRef.current) {
        return;
      }
      if (!selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', onClickOutside);
    return () => {
      document.removeEventListener('click', onClickOutside);
    };
  }, []);

  return (
    <div ref={selectRef} className="select-container">
      <button
        type="button"
        className={`select-trigger${isOpen ? ' is-open' : ''}${props.loading ? ' is-loading' : ''}`}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <span className="trigger-content">
          {selectedIcon ? (
            <span className="trigger-icon">
              <img className="icon" src={selectedIcon} alt="" aria-hidden="true" />
            </span>
          ) : null}
          <span className="trigger-label">{selectedProvider.name}</span>
        </span>
        {props.loading ? (
          <span className="loading-spinner" aria-label="Provider loading" role="status" />
        ) : null}
        <svg
          className={`chevron${isOpen ? ' is-open' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen ? (
        <div className="dropdown-menu dropdown-enter-active dropdown-enter-to">
          <div className="dropdown-scroll">
            {providerMetas.map((provider) => {
              const providerIcon = providerIcons[provider.key as keyof typeof providerIcons];
              const selected = provider.key === props.modelValue;

              return (
                <div
                  key={provider.key}
                  className={`dropdown-item${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    props.onChange(provider.key);
                    setIsOpen(false);
                  }}
                >
                  {providerIcon ? (
                    <span className="item-icon">
                      <img className="icon" src={providerIcon} alt="" aria-hidden="true" />
                    </span>
                  ) : null}
                  <span className="item-label">{provider.name}</span>
                  {selected ? (
                    <svg
                      className="checkmark"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
