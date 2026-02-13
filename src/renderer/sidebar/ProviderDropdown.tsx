import { Select } from '../ui/Select';

export function ProviderDropdown(props: {
  selectedKey: string;
  loading?: boolean;
  onChange: (providerKey: string) => void;
}) {
  return (
    <Select
      modelValue={props.selectedKey}
      loading={props.loading}
      onChange={props.onChange}
    />
  );
}
