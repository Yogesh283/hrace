export default function InputError({ message, className = '', ...props }) {
    return message ? (
        <p
            {...props}
            role="alert"
            className={'text-sm font-medium text-red-300 ' + className}
        >
            {message}
        </p>
    ) : null;
}
